import type { Metadata } from 'next';
import { ChartColumn, SearchX } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { ReportTable, type ReportRow } from '@/components/admin/report-table';

export const metadata: Metadata = { title: 'Myyntiraportti' };

// Sales come from our own database, the source of truth for what was sold.
// A sale is an order that was actually paid (PAID) or handed over (COMPLETED);
// RECEIVED (awaiting payment) and CANCELLED do not count. The period filters on
// the order date (createdAt), since paidAt is not set on every path.
const PERIODS = ['all', 'month', 'year', 'prev-year'] as const;
type Period = (typeof PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = {
  all: 'Kaikki',
  month: 'Kuluva kuukausi',
  year: 'Kuluva vuosi',
  'prev-year': 'Edellinen vuosi',
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function periodWindow(period: Period): { gte?: Date; lt?: Date } {
  const now = new Date();
  switch (period) {
    case 'month':
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'year':
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case 'prev-year':
      return {
        gte: new Date(now.getFullYear() - 1, 0, 1),
        lt: new Date(now.getFullYear(), 0, 1),
      };
    case 'all':
    default:
      return {};
  }
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const periodParam = first(params.period);
  const period: Period = PERIODS.includes(periodParam as Period)
    ? (periodParam as Period)
    : 'all';
  const window = periodWindow(period);

  const lines = await prisma.orderLine.findMany({
    where: {
      order: {
        status: { in: ['PAID', 'COMPLETED'] },
        ...(window.gte || window.lt ? { createdAt: window } : {}),
      },
    },
    select: {
      orderId: true,
      itemId: true,
      name: true,
      priceCents: true,
      quantity: true,
      item: { select: { category: { select: { name: true } } } },
    },
  });

  // Aggregate in JS: line revenue is priceCents × quantity, which the DB cannot
  // sum directly. The data volume (a troop store) makes this trivial.
  const orderIds = new Set<string>();
  let revenueCents = 0;
  let unitsSold = 0;
  const byItem = new Map<string, { name: string; units: number; revenueCents: number }>();
  const byCategory = new Map<string, { units: number; revenueCents: number }>();

  for (const line of lines) {
    const lineRevenue = line.priceCents * line.quantity;
    orderIds.add(line.orderId);
    revenueCents += lineRevenue;
    unitsSold += line.quantity;

    const item = byItem.get(line.itemId) ?? { name: line.name, units: 0, revenueCents: 0 };
    item.units += line.quantity;
    item.revenueCents += lineRevenue;
    byItem.set(line.itemId, item);

    const categoryName = line.item?.category?.name ?? 'Muu';
    const cat = byCategory.get(categoryName) ?? { units: 0, revenueCents: 0 };
    cat.units += line.quantity;
    cat.revenueCents += lineRevenue;
    byCategory.set(categoryName, cat);
  }

  const itemRows: ReportRow[] = [...byItem.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .map((item) => ({
      key: item.name,
      label: item.name,
      units: item.units,
      revenueCents: item.revenueCents,
    }));
  const categoryRows: ReportRow[] = [...byCategory.entries()]
    .map(([name, value]) => ({
      key: name,
      label: name,
      units: value.units,
      revenueCents: value.revenueCents,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const hasFilter = period !== 'all';
  const empty = hasFilter ? (
    <EmptyState
      variant="filtered"
      icon={<SearchX className="size-6" />}
      title="Ei tuloksia"
      description="Kokeile toista aikaväliä tai tyhjennä suodattimet."
      action={
        <ButtonLink href="/admin/reports" variant="outline">
          Tyhjennä suodattimet
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      icon={<ChartColumn className="size-6" />}
      title="Ei myyntiä tällä aikavälillä."
    />
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Myyntiraportti</h1>
        <div className="text-sm text-muted-foreground">Maksetut ja luovutetut tilaukset</div>
      </div>

      <FilterBar
        chips={{
          name: 'period',
          value: period === 'all' ? '' : period,
          options: PERIODS.map((value) => ({
            label: PERIOD_LABEL[value],
            value: value === 'all' ? '' : value,
          })),
          hrefFor: (value) => (value ? `/admin/reports?period=${value}` : '/admin/reports'),
        }}
        resultCount={orderIds.size}
        resultLabel="tilausta"
        clearHref="/admin/reports"
      />

      {/* Summary tiles */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryTile label="Myynti yhteensä" value={formatCents(revenueCents)} />
        <SummaryTile label="Tilauksia" value={String(orderIds.size)} />
        <SummaryTile label="Myytyjä tuotteita" value={`${unitsSold} kpl`} />
      </div>

      {lines.length === 0 ? (
        empty
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <ReportTable
            title="Myynti kategorioittain"
            caption="Myynti kategorioittain"
            rows={categoryRows}
          />
          <ReportTable
            title="Myynti tuotteittain"
            caption="Myynti tuotteittain"
            rows={itemRows}
          />
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
