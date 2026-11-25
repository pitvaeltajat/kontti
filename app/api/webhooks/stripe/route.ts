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
      if (orderId && session.payment_status === 'paid') {
        const newlyPaid = await markOrderPaid(orderId, session);
        // Only mail on the real transition, so a duplicate webhook delivery
        // doesn't send the receipt twice. Failures are logged, not thrown.
        // a broken mailer must not make Stripe retry the whole payment.
        if (newlyPaid) {
          await trySendEmail(`order receipt ${orderId}`, () => sendOrderReceiptEmail(orderId));
          await trySendEmail(`new-order notice ${orderId}`, () => sendNewOrderAdminEmail(orderId));
        }
      } else if (session.metadata?.kammiBookingId) {
        const bookingId = session.metadata.kammiBookingId;
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
      } else {
        if (!orderId) console.warn('checkout.session.completed ilman orderId:ta', session.id);
      }
      break;
    }
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const newlyPaid = await markOrderPaid(orderId, session);
        if (newlyPaid) {
          await trySendEmail(`order receipt ${orderId}`, () => sendOrderReceiptEmail(orderId));
          await trySendEmail(`new-order notice ${orderId}`, () => sendNewOrderAdminEmail(orderId));
        }
      } else {
        console.warn('checkout.session.async_payment_succeeded ilman orderId:ta', session.id);
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
