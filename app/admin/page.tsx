import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/refund-dialog';
import { RefundOrderForm } from '@/components/admin/order-actions';

export const metadata: Metadata = { title: 'Tilaukset' };

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  RECEIVED: { label: 'Vastaanotettu', variant: 'warning' },
  PAID: { label: 'Maksettu', variant: 'success' },
  CANCELLED: { label: 'Peruutettu', variant: 'secondary' },
};

const STATUSES = ['RECEIVED', 'PAID', 'CANCELLED'] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  await requireSuperAdmin();
  const { status: statusParam, error } = await searchParams;
  const filter = STATUSES.includes(statusParam as (typeof STATUSES)[number])
    ? (statusParam as (typeof STATUSES)[number])
    : undefined;

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : undefined,
    select: {
      id: true,
      status: true,
      createdAt: true,
      name: true,
      email: true,
      totalCents: true,
      paidAt: true,
      refundedAt: true,
      stripeSessionId: true,
      lines: {
        select: {
          id: true,
          name: true,
          quantity: true,
          priceCents: true,
          answers: true,
          item: { select: { id: true, name: true, isEvent: true } },
          participants: { select: { refundedAt: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const counts = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const totalCount = counts.reduce((sum, c) => sum + c._count._all, 0);

  const total = orders.reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tilaukset</h1>
        <div className="text-sm text-muted-foreground">
          Näytetään {orders.length} tilausta · yhteensä {formatCents(total)}
        </div>
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Status tabs */}
      <nav className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin"
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            filter === undefined
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
          }`}
        >
          Kaikki ({totalCount})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
            }`}
          >
            {STATUS_META[s].label} ({countBy[s] || 0})
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Ei tilauksia tällä suodattimella.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            // COMPLETED is a legacy database value; show it as paid now that
            // handing over is no longer a separate order status.
            const displayStatus = order.status === 'COMPLETED' ? 'PAID' : order.status;
            const eventLine = order.lines.find((line) => line.item.isEvent);
            const refundedAt =
              order.refundedAt ??
              order.lines
                .flatMap((line) => line.participants)
                .map((p) => p.refundedAt)
                .filter((d): d is Date => d !== null)
                .sort((a, b) => b.getTime() - a.getTime())[0] ??
              null;
            return (
              <div
                key={order.id}
                className={`relative rounded-lg border bg-card p-4 shadow-sm ${
                  eventLine ? 'transition-colors hover:bg-muted/40' : ''
                }`}
              >
                {eventLine && (
                  <Link
                    href={`/admin/events/${eventLine.item.id}/registrants`}
                    className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Avaa tapahtuman ${eventLine.item.name} ilmoittautuneet`}
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-semibold">
                      #{order.id.slice(-8).toUpperCase()}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {format(order.createdAt, 'd.M.yyyy HH:mm', { locale: fi })}
                      </span>
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      {order.name ?? 'Ei nimeä'} {order.email ? `· ${order.email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_META[displayStatus].variant}>
                      {STATUS_META[displayStatus].label}
                    </Badge>
                    {refundedAt && (
                      <Badge variant="secondary">
                        Hyvitetty {format(refundedAt, 'd.M.yyyy')}
                      </Badge>
                    )}
                    <span className="font-bold">{formatCents(order.totalCents)}</span>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 rounded-md bg-background p-3 text-sm">
                  {order.lines.map((line) => {
                    const answers = Array.isArray(line.answers)
                      ? (line.answers as {
                          questionId: string;
                          prompt?: string;
                          answer?: string | string[];
                        }[])
                      : [];
                    return (
                      <li key={line.id} className="space-y-1">
                        <div className="flex justify-between gap-3">
                          <span>
                            <Link
                              href={
                                line.item.isEvent
                                  ? `/admin/events/${line.item.id}`
                                  : `/admin/items/${line.item.id}`
                              }
                              className="relative z-10 font-medium hover:underline"
                            >
                              {line.name}
                            </Link>
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {line.quantity > 1
                              ? `${line.quantity} × ${formatCents(line.priceCents)}`
                              : formatCents(line.priceCents)}
                          </span>
                        </div>
                        {answers.length > 0 && (
                          <ul className="ml-4 space-y-0.5 text-xs text-muted-foreground">
                            {answers.map((answer) => (
                              <li key={answer.questionId}>
                                {answer.prompt}:{' '}
                                {Array.isArray(answer.answer)
                                  ? answer.answer.join(', ')
                                  : answer.answer}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="relative z-10 mt-3 flex flex-wrap gap-2">
                  {order.status === 'CANCELLED' &&
                    order.paidAt &&
                    order.stripeSessionId &&
                    order.totalCents > 0 &&
                    (order.refundedAt ? (
                      <Button variant="ghost" size="sm" disabled>
                        Palauta maksu
                      </Button>
                    ) : (
                      <ConfirmDialog
                        triggerLabel="Palauta maksu"
                        triggerVariant="ghost"
                        triggerSize="sm"
                        title="Palauta maksu"
                        description={
                          <>
                            Palautettava summa {formatCents(order.totalCents)}. Haluatko varmasti
                            palauttaa maksun? Summa palautetaan asiakkaan maksukortille.
                          </>
                        }
                      >
                        <RefundOrderForm
                          orderId={order.id}
                          statusParam={statusParam}
                          amountCents={order.totalCents}
                        />
                      </ConfirmDialog>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
