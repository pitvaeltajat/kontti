import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

export type FilterChip = { label: string; value: string; count?: number };

export type FilterBarProps = {
  search?: {
    name: string;
    value: string;
    placeholder: string;
    id?: string;
    hiddenParams?: Record<string, string | undefined>;
    onChange?: (value: string) => void;
  };
  chips?: {
    name: string;
    value: string;
    options: FilterChip[];
    hrefFor?: (value: string) => string;
    onChange?: (value: string) => void;
  };
  resultCount: number;
  resultLabel?: string;
  clearHref?: string;
  onClear?: () => void;
};

function chipClassName(active: boolean): string {
  return cn(
    'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  );
}

function resultText(count: number, label: string): string {
  if (count === 0) return 'Ei tuloksia';
  if (count === 1) return '1 tulos';
  return `${count} ${label}`;
}

function defaultChipHref(
  chips: NonNullable<FilterBarProps['chips']>,
  search: FilterBarProps['search'],
  hiddenParams: [string, string][],
  value: string,
): string {
  const params = new URLSearchParams();
  for (const [key, param] of hiddenParams) params.set(key, param);
  if (search?.value) params.set(search.name, search.value);
  params.set(chips.name, value);
  const query = params.toString();
  return query ? `?${query}` : '?';
}

export function FilterBar({
  search,
  chips,
  resultCount,
  resultLabel = 'tulosta',
  clearHref,
  onClear,
}: FilterBarProps) {
  const searchId = search?.id ?? `filter-search-${search?.name ?? 'q'}`;
  const hasActiveFilter = Boolean(search?.value.trim() || chips?.value);
  const hiddenParams = Object.entries(search?.hiddenParams ?? {}).filter(
    (entry): entry is [string, string] => {
      const [key, value] = entry;
      return value !== undefined && key !== search?.name && key !== chips?.name;
    },
  );

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {search &&
          (search.onChange ? (
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <label htmlFor={searchId} className="sr-only">
                Haku
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                name={search.name}
                value={search.value}
                onChange={(event) => search.onChange?.(event.target.value)}
                placeholder={search.placeholder}
                className="pl-9"
              />
            </div>
          ) : (
            <form method="get" role="search" className="relative min-w-0 flex-1 sm:max-w-md">
              <label htmlFor={searchId} className="sr-only">
                Haku
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={searchId}
                type="search"
                name={search.name}
                defaultValue={search.value}
                placeholder={search.placeholder}
                className="pl-9"
              />
              {chips?.value && <input type="hidden" name={chips.name} value={chips.value} />}
              {hiddenParams.map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            </form>
          ))}

        {chips && (
          <nav aria-label="Suodattimet" className="flex flex-wrap gap-2">
            {chips.options.map((option) => {
              const active = chips.value === option.value;
              const text = `${option.label}${
                option.count === undefined ? '' : ` (${option.count})`
              }`;

              if (chips.onChange) {
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chips.onChange?.(option.value)}
                    className={chipClassName(active)}
                  >
                    {text}
                  </button>
                );
              }

              return (
                <Link
                  key={option.value}
                  href={
                    chips.hrefFor?.(option.value) ??
                    defaultChipHref(chips, search, hiddenParams, option.value)
                  }
                  aria-current={active ? 'page' : undefined}
                  className={chipClassName(active)}
                >
                  {text}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {resultText(resultCount, resultLabel)}
        </p>
        {hasActiveFilter &&
          (onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-medium text-primary hover:underline"
            >
              Tyhjennä suodattimet
            </button>
          ) : clearHref ? (
            <Link href={clearHref} className="text-sm font-medium text-primary hover:underline">
              Tyhjennä suodattimet
            </Link>
          ) : null)}
      </div>
    </div>
  );
}
