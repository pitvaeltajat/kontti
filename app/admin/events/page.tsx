import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Plus, SearchX } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { formatEventDates, isEventOver, lowestVariantPrice } from '@/lib/catalog';
import { setEventHidden } from '@/lib/actions/admin';
import { requireEventAdmin } from '@/lib/admin-guard';
import { ButtonLink } from '@/components/ui/button-link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { FormButton } from '@/components/admin/form-button';

export const metadata: Metadata = { title: 'Tapahtumat' };

const PER_PAGE_OPTIONS = [25, 50, 100];
const DEFAULT_PER_PAGE = 25;
const SORT_KEYS = ['name', 'startsAt', 'status'] as const;
type SortKey = (typeof SORT_KEYS)[number];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type EventRow = {
  active: boolean;
  hidden: boolean;
  endsAt: Date | null;
  orderLines: { quantity: number; participants: { id: string }[] }[];
};

function participantCount(event: EventRow): number {
  return event.orderLines.reduce(
    (sum, line) => sum + (line.participants.length || line.quantity),
    0,
  );
}

function eventStatus(event: EventRow): string {
  if (!event.active) return 'inactive';
  if (event.hidden) return 'hidden';
  if (isEventOver(event.endsAt)) return 'over';
  return 'active';
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireEventAdmin();
  const params = await searchParams;
  const now = new Date();

  const q = first(params.q)?.trim() ?? '';
  const statusParam = first(params.status);
  const status =
    statusParam === 'upcoming' || statusParam === 'past' ? statusParam : undefined;
  const sortParam = first(params.sort);
  const sortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined;
  const dir: 'asc' | 'desc' = first(params.dir) === 'desc' ? 'desc' : 'asc';
  const pageParam = Number(first(params.page));
  const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const perPageParam = Number(first(params.perPage));
  const perPage = PER_PAGE_OPTIONS.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;

  const conditions: Prisma.ItemWhereInput[] = [{ isEvent: true }];
  if (status === 'upcoming') {
    conditions.push({ OR: [{ endsAt: null }, { endsAt: { gte: now } }] });
  }
  if (status === 'past') conditions.push({ endsAt: { lt: now } });
  if (q) conditions.push({ name: { contains: q, mode: 'insensitive' } });
  const where: Prisma.ItemWhereInput = { AND: conditions };

  const orderBy: Prisma.ItemOrderByWithRelationInput[] = (() => {
    switch (sortKey) {
      case 'name':
        return [{ name: dir }];
      case 'startsAt':
        return [{ startsAt: dir }, { name: 'asc' }];
      case 'status':
        return [{ active: dir }, { startsAt: 'desc' }];
      default:
        return [{ startsAt: 'desc' }, { name: 'asc' }];
    }
  })();

  const total = await prisma.item.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, pageCount);

  const events = await prisma.item.findMany({
    where,
    orderBy,
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      // Paid/handed-over orders plus issued-but-unpaid invoices are registrations.
      // Count participants, falling back to line quantity for pre-migration rows.
      orderLines: {
        where: {
          order: {
            OR: [
              { status: { in: ['PAID', 'COMPLETED'] } },
              { status: 'RECEIVED', stripeInvoiceId: { not: null } },
            ],
          },
        },
        select: { quantity: true, participants: { select: { id: true } } },
      },
      variants: { where: { active: true }, select: { priceCents: true } },
    },
  });

  const hasFilters = Boolean(q || status);

  function hrefWith(overrides: Record<string, string | undefined>): string {
    const merged: Record<string, string | undefined> = {
      q: q || undefined,
      status,
      sort: sortKey,
      dir: sortKey ? dir : undefined,
      perPage: perPage !== DEFAULT_PER_PAGE ? String(perPage) : undefined,
      ...overrides,
    };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) search.set(key, value);
    }
    const qs = search.toString();
    return qs ? `/admin/events?${qs}` : '/admin/events';
  }

  const columns: Column<(typeof events)[number]>[] = [
    {
      key: 'name',
      header: 'Tapahtuma',
      sortable: true,
      cell: (event) => (
        <Link
          href={`/${event.slug}`}
          className="font-medium hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {event.name}
          <span className="ml-1 text-xs text-muted-foreground">↗</span>
        </Link>
      ),
    },
    {
      key: 'startsAt',
      header: 'Ajankohta',
      sortable: true,
      cell: (event) => (
        <span className="text-muted-foreground">
          {formatEventDates(event.startsAt, event.endsAt) || 'ei päivää'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Hinta',
      align: 'right',
      cell: (event) => formatCents(lowestVariantPrice(event.variants)),
    },
    {
      key: 'participants',
      header: 'Ilmoittautuneita',
      align: 'right',
      cell: (event) => participantCount(event),
    },
    {
      key: 'status',
      header: 'Tila',
      sortable: true,
      cell: (event) => <StatusBadge status={eventStatus(event)} kind="event" />,
    },
    {
      key: 'actions',
      header: 'Toiminnot',
      align: 'right',
      cell: (event) => (
        <div className="flex justify-end gap-2">
          <ButtonLink
            href={`/admin/events/${event.id}/registrants`}
            size="sm"
            variant="outline"
          >
            Ilmoittautuneet ({participantCount(event)})
          </ButtonLink>
          <ButtonLink href={`/admin/events/${event.id}`} size="sm" variant="outline">
            Muokkaa
          </ButtonLink>
          <form action={setEventHidden}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="hidden" value={event.hidden ? 'false' : 'true'} />
            <FormButton size="sm" variant="ghost">
              {event.hidden ? 'Näytä' : 'Piilota'}
            </FormButton>
          </form>
        </div>
      ),
    },
  ];

  const empty = hasFilters ? (
    <EmptyState
      variant="filtered"
      icon={<SearchX className="size-6" />}
      title="Ei tuloksia"
      description="Kokeile toista hakusanaa tai tyhjennä suodattimet."
      action={
        <ButtonLink href="/admin/events" variant="outline">
          Tyhjennä suodattimet
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      icon={<CalendarDays className="size-6" />}
      title="Tapahtumia ei ole vielä"
      description="Luo ensimmäinen tapahtuma."
    />
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tapahtumat ({total})</h1>
        <ButtonLink href="/admin/events/new" variant="cta">
          <Plus /> Uusi tapahtuma
        </ButtonLink>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Tapahtuman ostaminen toimii ilmoittautumisena. Tapahtuma poistuu etusivulta automaattisesti
        viikon kuluttua päättymisestä, mutta siihen pääsee edelleen suoralla linkillä.
      </p>

      <FilterBar
        search={{
          name: 'q',
          value: q,
          placeholder: 'Hae tapahtumia',
          hiddenParams: {
            sort: sortKey,
            dir: sortKey ? dir : undefined,
            perPage: perPage !== DEFAULT_PER_PAGE ? String(perPage) : undefined,
          },
        }}
        chips={{
          name: 'status',
          value: status ?? '',
          options: [
            { label: 'Kaikki', value: '' },
            { label: 'Tulevat', value: 'upcoming' },
            { label: 'Menneet', value: 'past' },
          ],
          hrefFor: (value) => hrefWith({ status: value || undefined, page: undefined }),
        }}
        resultCount={total}
        clearHref="/admin/events"
      />

      <DataTable
        caption="Tapahtumat"
        columns={columns}
        rows={events}
        getRowKey={(event) => event.id}
        sort={sortKey ? { key: sortKey, direction: dir } : undefined}
        sortHref={(key, direction) => hrefWith({ sort: key, dir: direction, page: undefined })}
        empty={empty}
      />

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
