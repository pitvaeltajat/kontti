import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { markOrderPaid } from '@/lib/orders';
import { trySendEmail } from '@/lib/emails';
import { sendOrderReceiptEmail, sendNewOrderAdminEmail } from '@/lib/emails/orderEmails';

export async function POST(request: Request) {
  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 });
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Istunnon tunnus puuttuu.' }, { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Maksua ei ole vielä vahvistettu.' }, { status: 400 });
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'Tilausta ei löydy.' }, { status: 400 });
  }

  const newlyPaid = await markOrderPaid(orderId, session);

  if (newlyPaid) {
    trySendEmail('order receipt', () => sendOrderReceiptEmail(orderId));
    trySendEmail('admin notification', () => sendNewOrderAdminEmail(orderId));
  }

  return NextResponse.json({ ok: true });
}
