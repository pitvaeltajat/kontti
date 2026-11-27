'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCents } from '@/lib/money';

export type PayoutRow = {
  id: string;
  arrivalDate: string;
  status: string;
  descriptor: string | null;
  grossCents: number;
  feeCents: number;
  refundCents: number;
  netCents: number;
  lines: {
    id: string;
    description: string;
    grossCents: number;
    feeCents: number;
    netCents: number;
  }[];
};

const STATUS_OPTIONS = [
  { label: 'Kaikki', value: '' },
  { label: 'Maksettu', value: 'paid' },
  { label: 'Matkalla', value: 'in_transit' },
  { label: 'Odottaa', value: 'pending' },
  { label: 'Peruttu', value: 'canceled' },
  { label: 'Epäonnistui', value: 'failed' },
];

export function PayoutsList({ rows }: { rows: PayoutRow[] }) {
  const [status, setStatus] = useState('');

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const row of rows) {
      result.set(row.status, (result.get(row.status) ?? 0) + 1);
    }
    return result;
  }, [rows]);

  const visibleRows = status ? rows.filter((row) => row.status === status) : rows;

  function clearFilters() {
    setStatus('');
  }

  return (
    <div>
      <FilterBar
        chips={{
          name: 'status',
          value: status,
          options: STATUS_OPTIONS.map((option) => ({
            ...option,
            count: option.value ? (counts.get(option.value) ?? 0) : rows.length,
          })),
          onChange: setStatus,
        }}
        resultCount={visibleRows.length}
        onClear={clearFilters}
      />

      {visibleRows.length === 0 ? (
        <EmptyState
          variant="filtered"
          icon={<SearchX className="size-6" />}
          title="Ei tuloksia"
          description="Kokeile toista suodatusta tai tyhjennä suodattimet."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Tyhjennä suodattimet
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visibleRows.map((payout) => (
            <div key={payout.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <p className="font-semibold">
                    {format(new Date(payout.arrivalDate), 'd.M.yyyy', { locale: fi })}
                    {payout.descriptor && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {payout.descriptor}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    Brutto {formatCents(payout.grossCents)} · kulut {formatCents(payout.feeCents)}
                    {payout.refundCents > 0 && (
                      <> · palautukset {formatCents(payout.refundCents)}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={payout.status} kind="payout" />
                  <span className="font-bold">{formatCents(payout.netCents)}</span>
                </div>
              </div>

              {payout.lines.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Tapahtumat ({payout.lines.length})
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <caption className="sr-only">Tilityksen tapahtumat</caption>
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th scope="col" className="py-1 pr-3 font-medium">
                            Tapahtuma
                          </th>
                          <th scope="col" className="py-1 px-3 text-right font-medium">
                            Brutto
                          </th>
                          <th scope="col" className="py-1 px-3 text-right font-medium">
                            Kulu
                          </th>
                          <th scope="col" className="py-1 pl-3 text-right font-medium">
                            Netto
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payout.lines.map((line) => (
                          <tr key={line.id} className="border-b last:border-0">
                            <td className="py-1 pr-3">{line.description}</td>
                            <td className="py-1 px-3 text-right text-muted-foreground">
                              {formatCents(line.grossCents)}
                            </td>
                            <td className="py-1 px-3 text-right text-muted-foreground">
                              {formatCents(line.feeCents)}
                            </td>
                            <td className="py-1 pl-3 text-right font-medium">
                              {formatCents(line.netCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}