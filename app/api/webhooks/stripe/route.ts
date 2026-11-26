import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import {
  trySendEmail,
  sendOrderReceiptEmail,
  sendNewOrderAdminEmail,
  sendKammiConfirmationEmail,
  sendKammiPayerReceiptEmail,
  sendKammiCancellationEmail,
  sendKammiHostNotificationEmail,
} from '@/lib/emails';
import { confirmKammiBooking, cancelKammiBooking } from '@/lib/kammiBookings';
import { markOrderPaid } from '@/lib/orders';

export const dynamic = 'force-dynamic';

async function handlePaidSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (orderId) {
    const newlyPaid = await markOrderPaid(orderId, session);
    // Only mail on the real transition, so a duplicate webhook delivery
    // doesn't send the receipt twice. Failures are logged, not thrown.
    // a broken mailer must not make Stripe retry the whole payment.
    if (newlyPaid) {
      await trySendEmail(`order receipt ${orderId}`, () => sendOrderReceiptEmail(orderId));
      await trySendEmail(`new-order notice ${orderId}`, () => sendNewOrderAdminEmail(orderId));
    }
    return;
  }
  const bookingId = session.metadata?.kammiBookingId;
  if (bookingId) {
    const newlyConfirmed = await confirmKammiBooking(bookingId, session.id ?? null);
    if (newlyConfirmed) {
      await trySendEmail(`kammi confirmation ${bookingId}`, () =>
        sendKammiConfirmationEmail(bookingId),
      );
      await trySendEmail(`kammi payer receipt ${bookingId}`, () =>
        sendKammiPayerReceiptEmail(bookingId),
      );
      await trySendEmail(`kammi host notice ${bookingId}`, () =>
        sendKammiHostNotificationEmail(bookingId),
      );
    }
  }
}

/**
 * Stripe webhook receiver. Faithfully applied payments mark the Order PAID and
 * decrement stock; expired sessions cancel their RECEIVED order.
 *
 * Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 * and set STRIPE_WEBHOOK_SECRET (whsec_...) from its output.
 */
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Webhook ei ole konfiguroitu.' }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    console.error('Varmente epäonnistui:', err);
    return NextResponse.json({ error: 'Virheellinen allekirjoitus.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const kammiBookingId = session.metadata?.kammiBookingId;
      if (session.payment_status === 'paid' && (orderId || kammiBookingId)) {
        await handlePaidSession(session);
      } else if (!orderId && !kammiBookingId) {
        console.warn('checkout.session.completed ilman orderId:ta', session.id);
      } else {
        console.debug(
          'checkout.session.completed odottaa maksua',
          session.id,
          session.payment_status,
        );
      }
      break;
    }
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (session.metadata?.orderId || session.metadata?.kammiBookingId) {
        await handlePaidSession(session);
      } else {
        console.warn('checkout.session.async_payment_succeeded ilman orderId:ta', session.id);
      }
      break;
    }
    case 'payment_intent.succeeded': {
      // Bank redirects (verkkopankki) settle asynchronously: the Checkout
      // Session completes with payment_status 'unpaid' and only later does the
      // PaymentIntent succeed. Resolve the session and mark it paid so the
      // order flips to PAID even when the async Checkout event is not
      // subscribed.
      const paymentIntent = event.data.object;
      const sessions = await getStripe().checkout.sessions.list({
        payment_intent: paymentIntent.id,
        limit: 1,
      });
      const session = sessions.data[0];
      if (session) {
        await handlePaidSession(session);
      }
      break;
    }
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      if (session.metadata?.orderId) {
        console.warn(
          'Checkoutin viivästetty maksu epäonnistui',
          session.metadata.orderId,
          session.id,
        );
      } else if (session.metadata?.kammiBookingId) {
        const kammiBookingId = session.metadata.kammiBookingId;
        const booking = await prisma.kammiBooking.findUnique({
          where: { id: kammiBookingId },
          select: { id: true, paymentToken: true, status: true },
        });
        if (booking?.status === 'PENDING') {
          if (booking.paymentToken) {
            // A payer-separated booking is held indefinitely. Only the Stripe
            // checkout session failed; the booking and its payment link remain.
            await prisma.kammiBooking.updateMany({
              where: { id: booking.id, stripeSessionId: session.id },
              data: { stripeSessionId: null },
            });
          } else {
            await cancelKammiBooking(kammiBookingId);
            await trySendEmail(`kammi booking cancelled ${kammiBookingId}`, () =>
              sendKammiCancellationEmail(kammiBookingId),
            );
          }
        }
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await prisma.order.updateMany({
          where: { id: orderId, status: 'RECEIVED' },
          data: { status: 'CANCELLED' },
        });
      } else if (session.metadata?.kammiBookingId) {
        const booking = await prisma.kammiBooking.findUnique({
          where: { id: session.metadata.kammiBookingId },
          select: { id: true, paymentToken: true, status: true },
        });
        if (booking?.paymentToken && booking.status === 'PENDING') {
          // A payer-separated booking is held indefinitely. Only the Stripe
          // checkout session expires; the booking and its payment link remain.
          await prisma.kammiBooking.updateMany({
            where: { id: booking.id, stripeSessionId: session.id },
            data: { stripeSessionId: null },
          });
        } else {
          await cancelKammiBooking(session.metadata.kammiBookingId);
          await trySendEmail(`kammi booking cancelled ${session.metadata.kammiBookingId}`, () =>
            sendKammiCancellationEmail(session.metadata!.kammiBookingId!),
          );
        }
      }
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object;
      const orderId = invoice.metadata?.orderId;
      if (orderId) {
        const newlyPaid = await markOrderPaid(orderId, invoice);
        if (newlyPaid) {
          await trySendEmail(`order receipt ${orderId}`, () => sendOrderReceiptEmail(orderId));
          await trySendEmail(`new-order notice ${orderId}`, () => sendNewOrderAdminEmail(orderId));
        }
      } else {
        console.warn('invoice.paid ilman orderId:ta', invoice.id);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
