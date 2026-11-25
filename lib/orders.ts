// Stock decrement logic, separated from the webhook handler so it can be
// tested without a database. stock === null means unlimited (bundles, event
// registrations), and stays null.

import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export type StockSpend = { itemId: string; stock: number | null; quantity: number };

export type StockResult = { itemId: string; newStock: number | null };

export function applyQuantityToStock(spends: StockSpend[]): StockResult[] {
  return spends.map(({ itemId, stock, quantity }) => ({
    itemId,
    newStock: stock === null ? null : Math.max(0, stock - quantity),
  }));
}

/** Returns true only when this call performed the RECEIVED→PAID transition. */
export async function markOrderPaid(
  orderId: string,
  payment: Stripe.Checkout.Session | Stripe.Invoice,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order || ['PAID', 'COMPLETED', 'CANCELLED'].includes(order.status)) return false;

    const itemRows = await tx.item.findMany({
      where: { id: { in: order.lines.map((line) => line.itemId) } },
      select: { id: true, stock: true },
    });
    const stockById = new Map(itemRows.map((item) => [item.id, item.stock]));

    for (const line of order.lines) {
      if (stockById.get(line.itemId) === null) continue;
      const updated = await tx.item.updateMany({
        where: { id: line.itemId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (updated.count !== 1) {
        throw new Error(`Varasto muuttui maksun aikana tuotteelle ${line.itemId}`);
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        stripeSessionId: payment.object === 'checkout.session' ? payment.id : order.stripeSessionId,
        stripeInvoiceId: payment.object === 'invoice' ? payment.id : order.stripeInvoiceId,
        email:
          order.email ??
          (payment.object === 'checkout.session'
            ? payment.customer_details?.email
            : payment.object === 'invoice'
              ? payment.customer_email
              : null) ??
          null,
        name:
          order.name ??
          (payment.object === 'checkout.session'
            ? payment.customer_details?.name
            : payment.object === 'invoice'
              ? payment.customer_name
              : null) ??
          null,
      },
    });
    return true;
  });
}
