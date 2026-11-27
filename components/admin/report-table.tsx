'use client';

import { DataTable, type Column } from '@/components/ui/data-table';
import { formatCents } from '@/lib/money';

export type ReportRow = {
  key: string;
  label: string;
  units: number;
  revenueCents: number;
};

const COLUMNS: Column<ReportRow>[] = [
  {
    key: 'label',
    header: 'Nimi',
    sortable: true,
    cell: (row) => row.label,
  },
  {
    key: 'units',
    header: 'Kpl',
    align: 'right',
    sortable: true,
    cell: (row) => <span className="text-muted-foreground">{row.units}</span>,
  },
  {
    key: 'revenueCents',
    header: 'Myynti',
    align: 'right',
    sortable: true,
    cell: (row) => <span className="font-medium">{formatCents(row.revenueCents)}</span>,
  },
];

export function ReportTable({
  title,
  rows,
  caption = title,
}: {
  title: string;
  rows: ReportRow[];
  caption?: string;
}) {
  return (
    <div>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <DataTable
        caption={caption}
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.key}
        defaultSort={{ key: 'revenueCents', direction: 'desc' }}
      />
    </div>
  );
}