import type { Metadata } from 'next';
import { Wallet } from 'lucide-react';
import { getStripe } from '@/lib/stripe';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { EmptyState } from '@/components/ui/empty-state';
import { PayoutsList, type PayoutRow } from '@/components/admin/payouts-list';

export const metadata: Metadata = { title: 'Tilitykset' };

// Payouts and fees live in Stripe, not our database. We read them live from the
// Payouts + Balance Transactions APIs (not the async Reporting API, which is for
// downloadable accounting CSVs). Each payout is one deposit that lands in Holvi;
// its balance transactions break it down into gross sales, Stripe fees and
// refunds so the treasurer can reconcile the lump-sum deposit.

async function loadPayouts(): Promise<
  { ok: true; rows: PayoutRow[] } | { ok: false; error: string }
> {
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { ok: false, error: 'Stripe ei ole konfiguroitu (aseta STRIPE_SECRET_KEY).' };
  }

  try {
    const payouts = await stripe.payouts.list({ limit: 12 });
    const rows = await Promise.all(
      payouts.data.map(async (p): Promise<PayoutRow> => {
        // Transactions settled by this payout (the payout entry itself excluded).
        const txns = await stripe.balanceTransactions.list({ payout: p.id, limit: 100 });
        let grossCents = 0;
        let feeCents = 0;
        let refundCents = 0;
        const lines: PayoutRow['lines'] = [];
        for (const t of txns.data) {
          if (t.type === 'payout') continue;
          feeCents += t.fee;
          if (t.amount >= 0) grossCents += t.amount;
          else refundCents += -t.amount;
          lines.push({
            id: t.id,
            description: t.description ?? t.reporting_category ?? t.type,
            grossCents: t.amount,
            feeCents: t.fee,
            netCents: t.net,
          });
        }
        return {
          id: p.id,
          arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
          status: p.status,
          descriptor: p.statement_descriptor,
          grossCents,
          feeCents,
          refundCents,
          netCents: p.amount,
          lines,
        };
      }),
    );
    return { ok: true, rows };
  } catch (err) {
    console.error('Tilitysten haku Stripestä epäonnistui:', err);
    return { ok: false, error: 'Tilitysten haku Stripestä epäonnistui.' };
  }
}

export default async function AdminPayoutsPage() {
  await requireSuperAdmin();
  const result = await loadPayouts();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tilitykset</h1>
        <div className="text-sm text-muted-foreground">Stripen maksut pankkitilille (Holvi)</div>
      </div>

      {!result.ok ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {result.error}
        </p>
      ) : result.rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="Ei tilityksiä"
          description="Testitilassa Stripe ei maksa tilityksiä pankkitilille."
        />
      ) : (
        <PayoutsList rows={result.rows} />
      )}
    </div>
  );
}
