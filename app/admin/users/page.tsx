import type { Metadata } from 'next';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { SearchX, Users } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { deriveRole, type Role } from '@/lib/admin';
import { setUserRole } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { ButtonLink } from '@/components/ui/button-link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import { FormButton } from '@/components/admin/form-button';

export const metadata: Metadata = { title: 'Käyttäjät' };

const PER_PAGE_OPTIONS = [25, 50, 100];
const DEFAULT_PER_PAGE = 25;
const SORT_KEYS = ['email', 'name', 'role', 'createdAt'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const ROLE_VALUES: Role[] = ['SUPERADMIN', 'EVENT_ADMIN', 'USER'];

const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: 'Pääylläpitäjä',
  EVENT_ADMIN: 'Tapahtumavastaava',
  USER: 'Käyttäjä',
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const session = await auth();
  const myEmail = session?.user?.email?.trim().toLowerCase();
  const params = await searchParams;

  const q = first(params.q)?.trim() ?? '';
  const roleParam = first(params.role);
  const roleFilter = ROLE_VALUES.includes(roleParam as Role) ? (roleParam as Role) : undefined;
  const sortParam = first(params.sort);
  const sortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined;
  const dir: 'asc' | 'desc' = first(params.dir) === 'desc' ? 'desc' : 'asc';
  const pageParam = Number(first(params.page));
  const requestedPage = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const perPageParam = Number(first(params.perPage));
  const perPage = PER_PAGE_OPTIONS.includes(perPageParam) ? perPageParam : DEFAULT_PER_PAGE;

  // Deactivated (departed) members are hidden; the Workspace sync restores them
  // automatically if they rejoin the member group.
  const conditions: Prisma.UserWhereInput[] = [{ deletedAt: null }];
  if (roleFilter) conditions.push({ role: roleFilter });
  if (q) {
    conditions.push({
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  const where: Prisma.UserWhereInput = { AND: conditions };

  const orderBy: Prisma.UserOrderByWithRelationInput[] = (() => {
    switch (sortKey) {
      case 'email':
        return [{ email: dir }];
      case 'name':
        return [{ name: dir }];
      case 'role':
        return [{ role: dir }];
      case 'createdAt':
        return [{ createdAt: dir }];
      default:
        return [{ role: 'desc' }, { createdAt: 'asc' }];
    }
  })();

  const total = await prisma.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, pageCount);

  const users = await prisma.user.findMany({
    where,
    orderBy,
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const hasFilters = Boolean(q || roleFilter);

  function hrefWith(overrides: Record<string, string | undefined>): string {
    const merged: Record<string, string | undefined> = {
      q: q || undefined,
      role: roleFilter,
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
    return qs ? `/admin/users?${qs}` : '/admin/users';
  }

  const columns: Column<(typeof users)[number]>[] = [
    {
      key: 'email',
      header: 'Sähköposti',
      sortable: true,
      cell: (user) => (
        <span className="font-medium">
          {user.email}
          {user.email === myEmail && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(tämä tili)</span>
          )}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Nimi',
      sortable: true,
      cell: (user) => <span className="text-muted-foreground">{user.name ?? 'ei nimeä'}</span>,
    },
    {
      key: 'role',
      header: 'Rooli',
      sortable: true,
      cell: (user) => <StatusBadge status={user.role} kind="user" />,
    },
    {
      key: 'createdAt',
      header: 'Rekisteröitynyt',
      sortable: true,
      cell: (user) => (
        <span className="text-muted-foreground">
          {format(user.createdAt, 'd.M.yyyy', { locale: fi })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Toiminnot',
      align: 'right',
      cell: (user) => {
        const isMe = user.email === myEmail;
        const isSuper = user.role === 'SUPERADMIN';
        // Demoting a superadmin drops them back to their derived role.
        const demoteTo = deriveRole(user.email, null);
        return (
          <div className="flex justify-end">
            {!isMe && (
              <form action={setUserRole}>
                <input type="hidden" name="id" value={user.id} />
                <input type="hidden" name="role" value={isSuper ? demoteTo : 'SUPERADMIN'} />
                <FormButton
                  size="sm"
                  variant={isSuper ? 'ghost' : 'outline'}
                  confirm={{
                    title: 'Vaihda rooli',
                    description: `Vaihdetaanko käyttäjän ${user.email} rooliksi ${
                      ROLE_LABEL[isSuper ? demoteTo : 'SUPERADMIN']
                    }?`,
                    confirmLabel: 'Vaihda rooli',
                    tone: 'default',
                  }}
                >
                  {isSuper ? 'Poista pääylläpito' : 'Tee pääylläpitäjäksi'}
                </FormButton>
              </form>
            )}
          </div>
        );
      },
    },
  ];

  const empty = hasFilters ? (
    <EmptyState
      variant="filtered"
      icon={<SearchX className="size-6" />}
      title="Ei tuloksia"
      description="Kokeile toista hakusanaa tai tyhjennä suodattimet."
      action={
        <ButtonLink href="/admin/users" variant="outline">
          Tyhjennä suodattimet
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      icon={<Users className="size-6" />}
      title="Ei käyttäjiä vielä"
      description="Käyttäjä luodaan automaattisesti ensimmäisellä kirjautumisella."
    />
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Käyttäjät</h1>
      </div>

      <FilterBar
        search={{
          name: 'q',
          value: q,
          placeholder: 'Hae sähköpostilla tai nimellä',
          hiddenParams: {
            sort: sortKey,
            dir: sortKey ? dir : undefined,
            perPage: perPage !== DEFAULT_PER_PAGE ? String(perPage) : undefined,
          },
        }}
        chips={{
          name: 'role',
          value: roleFilter ?? '',
          options: [
            { label: 'Kaikki', value: '' },
            { label: 'Pääylläpitäjä', value: 'SUPERADMIN' },
            { label: 'Tapahtumavastaava', value: 'EVENT_ADMIN' },
            { label: 'Käyttäjä', value: 'USER' },
          ],
          hrefFor: (value) => hrefWith({ role: value || undefined, page: undefined }),
        }}
        resultCount={total}
        clearHref="/admin/users"
      />

      <DataTable
        caption="Käyttäjät"
        columns={columns}
        rows={users}
        getRowKey={(user) => user.id}
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
