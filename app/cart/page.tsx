import type { Metadata } from 'next';
import { CartShell } from '@/components/cart-shell';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Ostoskori' };

export default async function CartPage() {
  const session = await getSession();

  return (
    <div className="container py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ostoskori</h1>
      </div>
      <CartShell
        initialUser={{
          name: session?.user?.name ?? '',
          email: session?.user?.email ?? '',
        }}
      />
    </div>
  );
}
