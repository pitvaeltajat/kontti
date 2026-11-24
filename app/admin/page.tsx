import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { cancelOrder, cancelParticipant } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { FormButton } from '@/components/admin/form-button';

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
    include: {
      lines: {
        include: {
          item: { select: { id: true, name: true, isEvent: true } },
          participants: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } },
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
                    <span className="font-bold">{formatCents(order.totalCents)}</span>
                  </div>
                </div>

                <ul className="mt-3 divide-y rounded-md bg-background px-3 text-sm">
                  {order.lines.map((line) => {
                    const answers = Array.isArray(line.answers)
                      ? (line.answers as {
                          questionId: string;
                          prompt?: string;
                          answer?: string | string[];
                        }[])
                      : [];
                    return (
                      <li key={line.id} className="space-y-1 py-2 first:pt-3 last:pb-3">
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
                        {line.participants.length > 0 && (
                          <ul className="ml-4 divide-y text-xs">
                            {line.participants.map((participant) => (
                              <li
                                key={participant.id}
                                className="flex flex-wrap items-center justify-between gap-2 py-1 first:pt-0 last:pb-0"
                              >
                                <span className="text-muted-foreground">{participant.name}</span>
                                {(order.status === 'RECEIVED' || order.status === 'PAID') && (
                                  <form action={cancelParticipant} className="relative z-10">
                                    <input
                                      type="hidden"
                                      name="participantId"
                                      value={participant.id}
                                    />
                                    <FormButton
                                      size="sm"
                                      variant="ghost"
                                      confirm={`Perutaanko ${participant.name}?`}
                                    >
                                      Peru tilaus
                                    </FormButton>
                                  </form>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
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

                <div className="relative z-10 mt-3 flex flex-wrap gap-2 border-t pt-3">
                  {(order.status === 'RECEIVED' || order.status === 'PAID') && (
                    <StatusButton
                      orderId={order.id}
                      label="Peru koko tilaus"
                      variant="secondary"
                      confirm={`Peruutetaanko koko tilaus #${order.id.slice(-8).toUpperCase()}?`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusButton({
  orderId,
  label,
  variant = 'outline',
  confirm,
}: {
  orderId: string;
  label: string;
  variant?: 'outline' | 'ghost' | 'secondary';
  confirm?: string;
}) {
  return (
    <form action={cancelOrder}>
      <input type="hidden" name="id" value={orderId} />
      <FormButton size="sm" variant={variant} confirm={confirm}>
        {label}
      </FormButton>
    </form>
  );
}
