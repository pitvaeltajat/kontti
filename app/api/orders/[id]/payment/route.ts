import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

/**
 * Public order summary for the payment page. Exposes only product lines and
 * prices, never the buyer's contact details.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length >= 50) {
    return NextResponse.json({ error: 'Tilausta ei löydy.' }, { status: 404 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: {
        select: {
          name: true,
          variantName: true,
          priceCents: true,
          quantity: true,
          answers: true,
        },
      },
    },
  });
  if (!order || !order.stripeSessionId) {
    return NextResponse.json({ error: 'Tilausta ei löydy.' }, { status: 404 });
  }

  if (order.status !== 'RECEIVED') {
    return NextResponse.json(
      {
        error:
          order.status === 'CANCELLED' ? 'Tilaus on peruutettu.' : 'Tilaus on jo maksettu.',
        status: order.status,
        alreadyPaid: order.status === 'PAID' || order.status === 'COMPLETED',
      },
      { status: 410 },
    );
  }

  const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
  if (!session.client_secret) {
    return NextResponse.json(
      { error: 'Maksua ei voitu aloittaa. Yritä uudelleen.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    lines: order.lines,
    totalCents: order.totalCents,
    clientSecret: session.client_secret,
  });
}