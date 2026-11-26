'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

type Sort = { key: string; direction: 'asc' | 'desc' };

function statusLabel(row: RegistrantRow): string {
  if (row.participantRefundedAt) return 'Hyvitetty';
  if (row.status === 'RECEIVED') return 'Lasku avoinna';
  if (row.status === 'CANCELLED') return 'Peruutettu';
  return 'Maksettu';
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

export function RegistrantsTable({
  rows,
  columns,
  fileName,
  renderActions,
}: {
  rows: RegistrantRow[];
  columns: RegistrantColumn[];
  fileName: string;
  renderActions?: (row: RegistrantRow) => React.ReactNode;
}) {
  const [sort, setSort] = useState<Sort>({ key: 'createdAt', direction: 'asc' });

  const sortedRows = useMemo(() => {
    const direction = sort.direction === 'asc' ? 1 : -1;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column) return rows;
    return [...rows].sort((a, b) => {
      const result = value(a, column).localeCompare(value(b, column), 'fi', {
        numeric: true,
        sensitivity: 'base',
      });
      return result * direction;
    });
  }, [columns, rows, sort]);

  function toggleSort(key: string) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={downloadCsv}>
          <Download className="size-4" /> Lataa CSV
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={downloadXlsx}>
          <Download className="size-4" /> Lataa XLSX
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-muted-foreground">
              {columns.map((column) => {
                if (column.kind === 'actions') {
                  return (
                    <th key={column.key} className="px-4 py-3 font-normal align-middle">
                      Toiminnot
                    </th>
                  );
                }
                const active = sort.key === column.key;
                const ariaSort = active
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none';
                return (
                  <th
                    key={column.key}
                    aria-sort={ariaSort}
                    className="px-4 py-3 font-normal align-middle"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.label}
                      {active ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.id}
                className="border-b align-top transition-colors last:border-0 hover:bg-muted/40"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 ${
                      column.kind === 'name'
                        ? 'font-medium'
                        : column.kind === 'status' || column.kind === 'actions'
                          ? ''
                          : 'text-muted-foreground'
                    }`}
                  >
                    {column.kind === 'actions' ? (
                      renderActions?.(row)
                    ) : column.kind === 'status' ? (
                      row.participantRefundedAt ? (
                        <Badge variant="secondary">Hyvitetty</Badge>
                      ) : row.status === 'RECEIVED' ? (
                        <Badge variant="warning">Lasku avoinna</Badge>
                      ) : row.status === 'CANCELLED' ? (
                        <Badge variant="secondary">Peruutettu</Badge>
                      ) : (
                        <Badge variant="success">Maksettu</Badge>
                      )
                    ) : column.kind === 'email' ? (
                      (row.email ?? 'ei sähköpostia')
                    ) : column.kind === 'date' ? (
                      dateLabel(row.createdAt)
                    ) : (
                      value(row, column)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
