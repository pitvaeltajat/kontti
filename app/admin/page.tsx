import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { SearchX, ShoppingBag } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { CancelOrderForm, RefundOrderForm } from '@/components/admin/order-actions';

export const metadata: Metadata = { title: 'Tilaukset' };

const PER_PAGE_OPTIONS = [25, 50, 100];
const DEFAULT_PER_PAGE = 25;
const STATUSES = ['RECEIVED', 'PAID', 'CANCELLED'] as const;
type OrderStatusFilter = (typeof STATUSES)[number];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const q = first(params.q)?.trim() ?? '';
  const statusParam = first(params.status);
  const status = STATUSES.includes(statusParam as OrderStatusFilter)
    ? (statusParam as OrderStatusFilter)
    : undefined;
  const pageParam = Number(first(params.page));
  const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const perPageParam = Number(first(params.perPage));
  const perPage = PER_PAGE_OPTIONS.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;
  const error = first(params.error);

  const searchCondition: Prisma.OrderWhereInput | undefined = q
    ? {
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined;

  const conditions: Prisma.OrderWhereInput[] = [];
  if (status === 'PAID') conditions.push({ status: { in: ['PAID', 'COMPLETED'] } });
  else if (status) conditions.push({ status });
  if (searchCondition) conditions.push(searchCondition);
  const where: Prisma.OrderWhereInput = { AND: conditions };

  const [total, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ['status'],
      where: searchCondition,
      _count: { _all: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, pageCount);

  const orders = await prisma.order.findMany({
    where,
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
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const totalCount = counts.reduce((sum, c) => sum + c._count._all, 0);
  const countFor = (value: OrderStatusFilter) =>
    value === 'PAID'
      ? (countBy.PAID ?? 0) + (countBy.COMPLETED ?? 0)
      : (countBy[value] ?? 0);
  const hasFilters = Boolean(q || status);

  function hrefWith(overrides: Record<string, string | undefined>): string {
    const merged: Record<string, string | undefined> = {
      q: q || undefined,
      status,
      perPage: perPage !== DEFAULT_PER_PAGE ? String(perPage) : undefined,
      ...overrides,
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const qs = search.toString();
    return qs ? `/admin?${qs}` : '/admin';
  }

  const empty = hasFilters ? (
    <EmptyState
      variant="filtered"
      icon={<SearchX className="size-6" />}
      title="Ei tuloksia"
      description="Kokeile toista hakusanaa tai tyhjennä suodattimet."
      action={
        <ButtonLink href="/admin" variant="outline">
          Tyhjennä suodattimet
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState icon={<ShoppingBag className="size-6" />} title="Ei tilauksia" />
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tilaukset ({total})</h1>
      </div>

      {error && (
        <p className="mb-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <FilterBar
        search={{
          name: 'q',
          value: q,
          placeholder: 'Hae tilausnumerolla, nimellä tai sähköpostilla',
          hiddenParams: {
            perPage: perPage !== DEFAULT_PER_PAGE ? String(perPage) : undefined,
          },
        }}
        chips={{
          name: 'status',
          value: status ?? '',
          options: [
            { label: 'Kaikki', value: '', count: totalCount },
            { label: 'Vastaanotettu', value: 'RECEIVED', count: countFor('RECEIVED') },
            { label: 'Maksettu', value: 'PAID', count: countFor('PAID') },
            { label: 'Peruutettu', value: 'CANCELLED', count: countFor('CANCELLED') },
          ],
          hrefFor: (value) => hrefWith({ status: value || undefined, page: undefined }),
        }}
        resultCount={total}
        clearHref="/admin"
      />

      {orders.length === 0 ? (
        empty
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
                    <StatusBadge status={displayStatus} kind="order" />
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
                  {order.status === 'RECEIVED' && (
                    <CancelOrderForm orderId={order.id} statusParam={status} />
                  )}
                  {order.status === 'CANCELLED' &&
                    order.paidAt &&
                    order.stripeSessionId &&
                    order.totalCents > 0 &&
                    (order.refundedAt ? (
                      <Button variant="ghost" size="sm" disabled>
                        Palauta maksu
                      </Button>
                    ) : (
                      <RefundOrderForm
                        orderId={order.id}
                        statusParam={status}
                        amountCents={order.totalCents}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="mt-4">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            from={(page - 1) * perPage + 1}
            to={Math.min(page * perPage, total)}
            buildHref={(target) => hrefWith({ page: target === 1 ? undefined : String(target) })}
            perPage={{ value: perPage, options: PER_PAGE_OPTIONS, name: 'perPage' }}
          />
        </div>
      )}
    </div>
  );
}
