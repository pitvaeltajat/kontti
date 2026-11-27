import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PerPageSelect } from '@/components/ui/per-page-select';
import { cn } from '@/lib/cn';

export type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  buildHref: (page: number) => string;
  perPage?: { value: number; options: number[]; name: string };
};

type PageItem = number | 'ellipsis';

export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 0) return [];
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', pageCount];
  if (page >= pageCount - 3) {
    return [1, 'ellipsis', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', pageCount];
}

function withPerPage(href: string, name: string, value: number): string {
  const [beforeHash, hash = ''] = href.split('#');
  const [path, query = ''] = beforeHash.split('?');
  const params = new URLSearchParams(query);
  params.set(name, String(value));
  if (params.get('page') === '1') params.delete('page');
  const search = params.toString();
  return `${path}${search ? `?${search}` : ''}${hash ? `#${hash}` : ''}`;
}

const itemClassName =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium';

export function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  buildHref,
  perPage,
}: PaginationProps) {
  const perPageHrefs: Record<number, string> = {};
  if (perPage) {
    for (const option of perPage.options) {
      perPageHrefs[option] = withPerPage(buildHref(1), perPage.name, option);
    }
  }

  return (
    <nav
      aria-label="Sivutus"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        Näytetään {from}–{to} / {total}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className={cn(itemClassName, 'hover:bg-accent')}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Edellinen sivu</span>
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(itemClassName, 'pointer-events-none opacity-40')}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Edellinen sivu</span>
          </span>
        )}

        {pageItems(page, pageCount).map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="inline-flex h-8 min-w-8 items-center justify-center px-2 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={buildHref(item)}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                itemClassName,
                item === page ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              {item}
            </Link>
          ),
        )}

        {page < pageCount ? (
          <Link href={buildHref(page + 1)} className={cn(itemClassName, 'hover:bg-accent')}>
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Seuraava sivu</span>
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(itemClassName, 'pointer-events-none opacity-40')}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Seuraava sivu</span>
          </span>
        )}
      </div>

      {perPage && (
        <PerPageSelect
          value={perPage.value}
          options={perPage.options}
          name={perPage.name}
          hrefs={perPageHrefs}
          label="Rivejä sivulla"
        />
      )}
    </nav>
  );
}
