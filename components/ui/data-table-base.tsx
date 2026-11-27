import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

export type SortDirection = 'asc' | 'desc';
export type SortState = { key: string; direction: SortDirection };

export type Column<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  headerClassName?: string;
  cellClassName?: string;
};

export type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  empty?: ReactNode;
  sort?: SortState;
  sortHref?: (key: string, direction: SortDirection) => string;
  defaultSort?: SortState;
  stickyHeader?: boolean;
  rowHref?: (row: T) => string;
  rowLabel?: (row: T) => string;
  rowClassName?: (row: T) => string;
  renderExpandedRow?: (row: T) => ReactNode;
};

export type DataTableBaseProps<T> = DataTableProps<T> & {
  mode?: 'server' | 'client';
  onSort?: (key: string) => void;
};

function sortValue<T>(row: T, column: Column<T>): string | number {
  if (column.sortValue) return column.sortValue(row) ?? '';
  const value = (row as unknown as Record<string, unknown>)[column.key];
  if (typeof value === 'number') return value;
  return value == null ? '' : String(value);
}

export function compareRows<T>(a: T, b: T, column: Column<T>): number {
  const left = sortValue(a, column);
  const right = sortValue(b, column);
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'fi', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function DataTableBase<T>({
  caption,
  columns,
  rows,
  getRowKey,
  empty,
  sort,
  sortHref,
  stickyHeader = true,
  rowHref,
  rowLabel,
  rowClassName,
  renderExpandedRow,
  mode = 'server',
  onSort,
}: DataTableBaseProps<T>) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm',
        stickyHeader ? 'max-h-[70vh] overflow-auto' : 'overflow-x-auto',
      )}
    >
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b text-xs uppercase text-muted-foreground">
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const ariaSort = active
                ? sort?.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none';
              const nextDirection: SortDirection =
                active && sort?.direction === 'asc' ? 'desc' : 'asc';
              const icon = active ? (
                sort?.direction === 'asc' ? (
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                )
              ) : (
                <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />
              );

              let header: ReactNode = column.header;
              if (column.sortable) {
                const content = (
                  <>
                    {column.header}
                    {icon}
                  </>
                );
                if (mode === 'client' && onSort) {
                  header = (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="inline-flex items-center gap-1.5 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {content}
                    </button>
                  );
                } else if (sortHref) {
                  header = (
                    <Link
                      href={sortHref(column.key, nextDirection)}
                      className="inline-flex items-center gap-1.5 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {content}
                    </Link>
                  );
                }
              }

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? ariaSort : undefined}
                  className={cn(
                    'px-4 py-3 font-normal align-middle',
                    stickyHeader && 'sticky top-0 z-10 bg-card',
                    column.align === 'right' && 'text-right',
                    column.headerClassName,
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-1.5',
                      column.align === 'right' && 'justify-end',
                    )}
                  >
                    {header}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-4">
                {empty ?? (
                  <EmptyState
                    variant="filtered"
                    title="Ei tuloksia"
                    description="Kokeile toista hakusanaa tai tyhjennä suodattimet."
                  />
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = getRowKey(row);
              return (
                <Fragment key={key}>
                  <tr
                    className={cn(
                      'border-b transition-colors last:border-0 hover:bg-muted/40',
                      rowHref && 'relative',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-3 align-middle',
                          column.align === 'right' && 'text-right',
                          column.cellClassName,
                        )}
                      >
                        {rowHref ? (
                          <>
                            {index === 0 && (
                              <Link
                                href={rowHref(row)}
                                aria-label={rowLabel?.(row) ?? caption}
                                className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            )}
                            <div className="relative z-10">{column.cell(row)}</div>
                          </>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                  {renderExpandedRow && (
                    <tr className="border-b bg-muted/20 last:border-0">
                      <td colSpan={columns.length} className="px-4 py-3">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
