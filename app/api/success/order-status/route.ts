import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id')?.trim() ?? '';
  const orderId = searchParams.get('order_id')?.trim() ?? '';

  let where: { stripeSessionId: string } | { id: string };
  if (sessionId) {
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    where = { stripeSessionId: sessionId };
  } else if (orderId) {
    if (orderId.length > 64) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    where = { id: orderId };
  } else {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const order = await prisma.order.findFirst({
    where,
    select: { status: true },
  });
  if (!order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ status: order.status }, { headers: { 'Cache-Control': 'no-store' } });
}
