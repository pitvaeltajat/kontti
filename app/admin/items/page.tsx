import type { Metadata } from 'next';
import Link from 'next/link';
import { Package, Plus, SearchX } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatCents } from '@/lib/money';
import { hideItem, restoreItem } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { ButtonLink } from '@/components/ui/button-link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { FormButton } from '@/components/admin/form-button';
import { lowestVariantPrice } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Tuotteet' };

const PER_PAGE_OPTIONS = [25, 50, 100];
const DEFAULT_PER_PAGE = 25;
const SORT_KEYS = ['name', 'category', 'stock', 'status', 'featured'] as const;
type SortKey = (typeof SORT_KEYS)[number];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;

  const q = first(params.q)?.trim() ?? '';
  const statusParam = first(params.status);
  const status = statusParam === 'active' || statusParam === 'hidden' ? statusParam : undefined;
  const sortParam = first(params.sort);
  const sortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined;
  const dir: 'asc' | 'desc' = first(params.dir) === 'desc' ? 'desc' : 'asc';
  const pageParam = Number(first(params.page));
  const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const perPageParam = Number(first(params.perPage));
  const perPage = PER_PAGE_OPTIONS.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;

  const conditions: Prisma.ItemWhereInput[] = [{ isEvent: false }];
  if (status === 'active') conditions.push({ active: true });
  if (status === 'hidden') conditions.push({ active: false });
  if (q) {
    conditions.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  const where: Prisma.ItemWhereInput = { AND: conditions };

  const orderBy: Prisma.ItemOrderByWithRelationInput[] = (() => {
    switch (sortKey) {
      case 'name':
        return [{ name: dir }];
      case 'category':
        return [{ category: { sortOrder: dir } }, { name: 'asc' }];
      case 'stock':
        return [{ stock: dir }, { name: 'asc' }];
      case 'status':
        return [{ active: dir }, { name: 'asc' }];
      case 'featured':
        return [{ featured: dir }, { name: 'asc' }];
      default:
        return [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }];
    }
  })();

  const total = await prisma.item.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, pageCount);

  const items = await prisma.item.findMany({
    where,
    orderBy,
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      category: true,
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
    return qs ? `/admin/items?${qs}` : '/admin/items';
  }

  const columns: Column<(typeof items)[number]>[] = [
    {
      key: 'name',
      header: 'Tuote',
      sortable: true,
      cell: (item) => (
        <Link
          href={`/${item.slug}`}
          className="font-medium hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {item.name}
          <span className="ml-1 text-xs text-muted-foreground">↗</span>
        </Link>
      ),
    },
    {
      key: 'category',
      header: 'Kategoria',
      sortable: true,
      cell: (item) => <span className="text-muted-foreground">{item.category.name}</span>,
    },
    {
      key: 'price',
      header: 'Hinta',
      align: 'right',
      cell: (item) => formatCents(lowestVariantPrice(item.variants)),
    },
    {
      key: 'stock',
      header: 'Varasto',
      align: 'right',
      sortable: true,
      cell: (item) => (item.stock === null ? 'Rajoittamaton' : item.stock),
    },
    {
      key: 'status',
      header: 'Tila',
      sortable: true,
      cell: (item) => <StatusBadge status={item.active ? 'active' : 'hidden'} kind="item" />,
    },
    {
      key: 'featured',
      header: 'Etusivu',
      sortable: true,
      cell: (item) => (item.featured ? 'Nosto' : ''),
    },
    {
      key: 'actions',
      header: 'Toiminnot',
      align: 'right',
      cell: (item) => (
        <div className="flex justify-end gap-2">
          <ButtonLink href={`/admin/items/${item.id}`} size="sm" variant="outline">
            Muokkaa
          </ButtonLink>
          {item.active ? (
            <form action={hideItem}>
              <input type="hidden" name="id" value={item.id} />
              <FormButton
                size="sm"
                variant="ghost"
                confirm={{
                  title: 'Piilota tuote',
                  description: `Piilota ”${item.name}” kaupasta? Voit palauttaa sen muokkaamalla.`,
                  confirmLabel: 'Piilota',
                  tone: 'default',
                }}
              >
                Piilota
              </FormButton>
            </form>
          ) : (
            <form action={restoreItem}>
              <input type="hidden" name="id" value={item.id} />
              <FormButton size="sm" variant="ghost">
                Palauta
              </FormButton>
            </form>
          )}
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
        <ButtonLink href="/admin/items" variant="outline">
          Tyhjennä suodattimet
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      icon={<Package className="size-6" />}
      title="Ei tuotteita vielä"
      description="Luo ensimmäinen tuote, niin se näkyy kaupassa."
      action={
        <ButtonLink href="/admin/items/new" variant="cta">
          <Plus /> Luo ensimmäinen tuote
        </ButtonLink>
      }
    />
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tuotteet ({total})</h1>
        <ButtonLink href="/admin/items/new" variant="cta">
          <Plus /> Uusi tuote
        </ButtonLink>
      </div>

      <FilterBar
        search={{
          name: 'q',
          value: q,
          placeholder: 'Hae tuotteita',
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
            { label: 'Näkyvät', value: 'active' },
            { label: 'Piilotetut', value: 'hidden' },
          ],
          hrefFor: (value) => hrefWith({ status: value || undefined, page: undefined }),
        }}
        resultCount={total}
        clearHref="/admin/items"
      />

      <DataTable
        caption="Kaupan tuotteet"
        columns={columns}
        rows={items}
        getRowKey={(item) => item.id}
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
