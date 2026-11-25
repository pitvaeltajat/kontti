import type { Metadata } from 'next';
import { CheckoutShell } from '@/components/checkout-shell';

export const metadata: Metadata = { title: 'Maksu' };

export default async function MaksuPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

  return (
    <div className="container py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Maksu</h1>
      </div>
      <CheckoutShell orderId={orderId ?? null} />
    </div>
  );
}
