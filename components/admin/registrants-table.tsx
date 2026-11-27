'use client';

import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { Download, SearchX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  compareRows,
  DataTableBase,
  type Column as DataTableColumn,
  type SortState,
} from '@/components/ui/data-table-base';
import { buildXlsx, toCsv } from '@/lib/spreadsheet';

export type RegistrantColumnKind = 'name' | 'email' | 'answer' | 'date' | 'status' | 'actions';

export type RegistrantColumn = {
  key: string;
  label: string;
  kind: RegistrantColumnKind;
};

export type RegistrantRow = {
  id: string;
  participantId: string | null;
  orderId: string;
  name: string;
  email: string | null;
  createdAt: string;
  status: string;
  answers: Record<string, string>;
  orderPaidAt: string | null;
  orderStripeSessionId: string | null;
  orderTotalCents: number;
  participantCancelled: boolean;
  participantCancelledAt: string | null;
  participantPriceCents: number;
  participantRefundedAt: string | null;
};

type RegistrantStatus = 'PAID' | 'RECEIVED' | 'CANCELLED' | 'REFUNDED';

const PER_PAGE = 25;

const STATUS_LABEL: Record<RegistrantStatus, string> = {
  PAID: 'Maksettu',
  RECEIVED: 'Lasku avoinna',
  CANCELLED: 'Peruutettu',
  REFUNDED: 'Hyvitetty',
};

const STATUS_OPTIONS = [
  { label: 'Kaikki', value: '' },
  { label: STATUS_LABEL.PAID, value: 'PAID' },
  { label: STATUS_LABEL.RECEIVED, value: 'RECEIVED' },
  { label: STATUS_LABEL.CANCELLED, value: 'CANCELLED' },
  { label: STATUS_LABEL.REFUNDED, value: 'REFUNDED' },
];

export function registrantStatus(row: RegistrantRow): RegistrantStatus {
  if (row.participantRefundedAt) return 'REFUNDED';
  if (row.status === 'RECEIVED') return 'RECEIVED';
  if (row.status === 'CANCELLED') return 'CANCELLED';
  return 'PAID';
}

function statusLabel(row: RegistrantRow): string {
  return STATUS_LABEL[registrantStatus(row)];
}

function dateLabel(iso: string): string {
  return format(new Date(iso), 'd.M.yyyy HH:mm', { locale: fi });
}

function exportDateLabel(iso: string): string {
  return format(new Date(iso), 'd.M.yyyy HH:mm:ss', { locale: fi });
}

function value(row: RegistrantRow, column: RegistrantColumn): string {
  switch (column.kind) {
    case 'name':
      return row.name;
    case 'email':
      return row.email ?? '';
    case 'date':
      return row.createdAt;
    case 'status':
      return statusLabel(row);
    case 'answer':
      return row.answers[column.key] ?? '';
    case 'actions':
      return '';
  }
}

function exportValue(row: RegistrantRow, column: RegistrantColumn): string {
  if (column.kind === 'date') return exportDateLabel(row.createdAt);
  return value(row, column);
}

function cellClassName(kind: RegistrantColumnKind): string | undefined {
  if (kind === 'name') return 'font-medium';
  if (kind === 'email' || kind === 'date' || kind === 'answer') {
    return 'text-muted-foreground';
  }
  return undefined;
}

export function RegistrantsTable({
  rows,
  columns,
  fileName,
  renderActions,
}: {
  rows: RegistrantRow[];
  columns: RegistrantColumn[];
  fileName: string;
  renderActions?: (row: RegistrantRow) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });

  const searchedRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fi');
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.name.toLocaleLowerCase('fi').includes(query) ||
        (row.email ?? '').toLocaleLowerCase('fi').includes(query) ||
        row.orderId.toLocaleLowerCase('fi').includes(query),
    );
  }, [rows, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<RegistrantStatus, number> = {
      PAID: 0,
      RECEIVED: 0,
      CANCELLED: 0,
      REFUNDED: 0,
    };
    for (const row of searchedRows) {
      counts[registrantStatus(row)] += 1;
    }
    return counts;
  }, [searchedRows]);

  const filteredRows = useMemo(
    () =>
      status ? searchedRows.filter((row) => registrantStatus(row) === status) : searchedRows,
    [searchedRows, status],
  );

  const dataColumns = useMemo<DataTableColumn<RegistrantRow>[]>(
    () =>
      columns.map((column) => {
        if (column.kind === 'actions') {
          return {
            key: column.key,
            header: 'Toiminnot',
            align: 'right' as const,
            cell: (row: RegistrantRow) => renderActions?.(row),
          };
        }
        return {
          key: column.key,
          header: column.label,
          sortable: true,
          cell: (row: RegistrantRow) => {
            if (column.kind === 'status') {
              return <StatusBadge status={registrantStatus(row)} kind="registrant" />;
            }
            if (column.kind === 'email') return row.email ?? 'ei sähköpostia';
            if (column.kind === 'date') return dateLabel(row.createdAt);
            return value(row, column);
          },
          cellClassName: cellClassName(column.kind),
          sortValue: (row: RegistrantRow) => value(row, column),
        };
      }),
    [columns, renderActions],
  );

  const sortedRows = useMemo(() => {
    const column = dataColumns.find((candidate) => candidate.key === sort.key);
    if (!column) return filteredRows;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => direction * compareRows(a, b, column));
  }, [dataColumns, filteredRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PER_PAGE;
  const pageRows = sortedRows.slice(start, start + PER_PAGE);
  const from = sortedRows.length === 0 ? 0 : start + 1;
  const to = Math.min(start + PER_PAGE, sortedRows.length);
  const hasFilters = Boolean(search.trim() || status);

  function toggleSort(key: string) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }

  function clearFilters() {
    setSearch('');
    setStatus('');
    setPage(1);
  }

  function handlePageClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    const anchor = target?.closest('a');
    if (!anchor) return;
    event.preventDefault();
    const href = anchor.getAttribute('href') ?? '';
    const targetPage = Number(new URLSearchParams(href.split('?')[1] ?? '').get('page'));
    if (Number.isInteger(targetPage) && targetPage > 0) setPage(targetPage);
  }

  function matrix(): string[][] {
    const exportColumns = columns.filter((column) => column.kind !== 'actions');
    return [
      exportColumns.map((column) => column.label),
      ...sortedRows.map((row) => exportColumns.map((column) => exportValue(row, column))),
    ];
  }

  function download(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    download(`${fileName}.csv`, new Blob([toCsv(matrix())], { type: 'text/csv;charset=utf-8' }));
  }

  function downloadXlsx() {
    const bytes = buildXlsx(matrix(), 'Ilmoittautuneet');
    download(
      `${fileName}.xlsx`,
      new Blob([bytes as unknown as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  }

  const empty = hasFilters ? (
    <EmptyState
      variant="filtered"
      icon={<SearchX className="size-6" />}
      title="Ei tuloksia"
      description="Kokeile toista hakusanaa tai tyhjennä suodattimet."
      action={
        <Button variant="outline" onClick={clearFilters}>
          Tyhjennä suodattimet
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<Users className="size-6" />}
      title="Ei vielä maksettuja tai laskutettuja ilmoittautumisia."
    />
  );

  return (
    <div>
      <FilterBar
        search={{
          name: 'q',
          value: search,
          placeholder: 'Hae ilmoittautuneita',
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        chips={{
          name: 'status',
          value: status,
          options: STATUS_OPTIONS.map((option) => ({
            ...option,
            count: option.value
              ? statusCounts[option.value as RegistrantStatus]
              : searchedRows.length,
          })),
          onChange: (nextStatus) => {
            setStatus(nextStatus);
            setPage(1);
          },
        }}
        resultCount={filteredRows.length}
        onClear={clearFilters}
      />

      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={downloadCsv}>
          <Download className="size-4" /> Lataa CSV
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={downloadXlsx}>
          <Download className="size-4" /> Lataa XLSX
        </Button>
      </div>

      <DataTableBase
        caption="Ilmoittautuneet"
        columns={dataColumns}
        rows={pageRows}
        getRowKey={(row) => row.id}
        sort={sort}
        mode="client"
        onSort={toggleSort}
        empty={empty}
      />

      {sortedRows.length > 0 && (
        <div className="mt-4" onClickCapture={handlePageClickCapture}>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={sortedRows.length}
            from={from}
            to={to}
            buildHref={(target) => `?page=${target}`}
          />
        </div>
      )}
    </div>
  );
}
