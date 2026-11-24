import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

export type CancelParticipantResult =
  | { ok: true; participantName: string; orderCancelled: boolean; refundedCents: number }
  | { ok: false; error: string; status: number };

class CancelError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const CANCELLABLE = ['RECEIVED', 'PAID', 'COMPLETED'] as const;

const participantSelect = {
  id: true,
  name: true,
  cancelledAt: true,
  orderLine: {
    select: {
      id: true,
      quantity: true,
      priceCents: true,
      itemId: true,
      item: { select: { stock: true } },
      order: {
        select: {
          id: true,
          status: true,
          totalCents: true,
          stripeSessionId: true,
          stripeInvoiceId: true,
        },
      },
    },
  },
} as const;

type ParticipantForCancel = {
  id: string;
  name: string;
  cancelledAt: Date | null;
  orderLine: {
    id: string;
    quantity: number;
    priceCents: number;
    itemId: string;
    item: { stock: number | null };
    order: {
      id: string;
      status: string;
      totalCents: number;
      stripeSessionId: string | null;
      stripeInvoiceId: string | null;
    };
  };
};

function assertCancellable(participant: ParticipantForCancel, orderId?: string) {
  const order = participant.orderLine.order;
  if (orderId && order.id !== orderId) {
    throw new CancelError('Ilmoittautumista ei löydy.', 404);
  }
  if (!CANCELLABLE.includes(order.status as (typeof CANCELLABLE)[number])) {
    throw new CancelError('Ilmoittautumista ei voi enää perua.', 400);
  }
  if (order.status === 'RECEIVED' && order.stripeInvoiceId) {
    throw new CancelError('Laskullisen ilmoittautumisen voi perua vain kokonaan.', 400);
  }
  if (participant.cancelledAt) {
    throw new CancelError('Ilmoittautuminen on jo peruttu.', 400);
  }
}

/**
 * Removes one participant from an event order, reducing the line quantity and
 * order total. With `refund` and a paid Stripe checkout, refunds that
 * participant's share first. Used by the admin (manual refunds) and the
 * event-payment link (automatic refund).
 */
export async function cancelParticipantRegistration(
  participantId: string,
  options: { refund: boolean; orderId?: string },
): Promise<CancelParticipantResult> {
  let participant: ParticipantForCancel | null;
  try {
    participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: participantSelect,
    });
    if (!participant) throw new CancelError('Ilmoittautumista ei löydy.', 404);
    assertCancellable(participant, options.orderId);
  } catch (error) {
    if (error instanceof CancelError) return { ok: false, error: error.message, status: error.status };
    console.error('Ilmoittautumisen peruminen epäonnistui:', error);
    return { ok: false, error: 'Ilmoittautumisen peruminen epäonnistui.', status: 500 };
  }

  const order = participant.orderLine.order;
  let refundedCents = 0;
  if (
    options.refund &&
    (order.status === 'PAID' || order.status === 'COMPLETED') &&
    order.totalCents > 0 &&
    participant.orderLine.priceCents > 0
  ) {
    if (!order.stripeSessionId) {
      return { ok: false, error: 'Maksun palautus pitää käsitellä ylläpidossa.', status: 400 };
    }
    try {
      const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId, {
        expand: ['payment_intent'],
      });
      const paymentIntent = session.payment_intent;
      const paymentIntentId =
        typeof paymentIntent === 'string' ? paymentIntent : (paymentIntent?.id ?? null);
      if (!paymentIntentId) throw new Error('Maksun tunnistetta ei löytynyt.');
      await getStripe().refunds.create(
        { payment_intent: paymentIntentId, amount: participant.orderLine.priceCents },
        { idempotencyKey: `event-registration-refund:${order.id}:${participant.id}` },
      );
      refundedCents = participant.orderLine.priceCents;
    } catch (error) {
      console.error('Tapahtumamaksun osapalautus epäonnistui:', error);
      return {
        ok: false,
        error: 'Maksua ei voitu palauttaa automaattisesti. Ota yhteyttä ylläpitoon.',
        status: 502,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.participant.findUnique({
        where: { id: participant.id },
        select: participantSelect,
      });
      if (!current) throw new CancelError('Ilmoittautumista ei löydy.', 404);
      assertCancellable(current, options.orderId);

      const line = current.orderLine;
      const cancelled = await tx.participant.updateMany({
        where: { id: current.id, orderLineId: line.id, cancelledAt: null },
        data: { cancelledAt: new Date() },
      });
      if (cancelled.count !== 1) throw new CancelError('Ilmoittautuminen on jo peruttu.', 400);

      await tx.orderLine.update({
        where: { id: line.id },
        data: { quantity: Math.max(0, line.quantity - 1) },
      });

      if (
        (line.order.status === 'PAID' || line.order.status === 'COMPLETED') &&
        line.item.stock !== null
      ) {
        await tx.item.update({
          where: { id: line.itemId },
          data: { stock: { increment: 1 } },
        });
      }

      const remainingLines = await tx.orderLine.findMany({
        where: { orderId: line.order.id },
        select: { quantity: true },
      });
      const orderCancelled = !remainingLines.some((remaining) => remaining.quantity > 0);
      await tx.order.update({
        where: { id: line.order.id },
        data: {
          totalCents: Math.max(0, line.order.totalCents - line.priceCents),
          ...(orderCancelled ? { status: 'CANCELLED' as const } : {}),
        },
      });

      return {
        orderCancelled,
        originalStatus: line.order.status,
        stripeSessionId: line.order.stripeSessionId,
        orderId: line.order.id,
      };
    });

    if (result.originalStatus === 'RECEIVED' && result.stripeSessionId) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(result.stripeSessionId);
        if (session.status === 'open') await getStripe().checkout.sessions.expire(session.id);
      } catch (error) {
        console.error('Vanhan checkout-istunnon sulkeminen epäonnistui:', error);
      }
      await prisma.order.update({
        where: { id: result.orderId },
        data: { stripeSessionId: null },
      });
    }

    return {
      ok: true,
      participantName: participant.name,
      orderCancelled: result.orderCancelled,
      refundedCents,
    };
  } catch (error) {
    if (error instanceof CancelError) return { ok: false, error: error.message, status: error.status };
    console.error('Ilmoittautumisen peruminen epäonnistui:', error);
    return { ok: false, error: 'Ilmoittautumisen peruminen epäonnistui.', status: 500 };
  }
}
