'use client';

import { useMemo, useState } from 'react';
import {
  compareRows,
  DataTableBase,
  type DataTableProps,
  type SortState,
} from '@/components/ui/data-table-base';

export function DataTableClient<T>(props: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | undefined>(props.defaultSort);

  const sortedRows = useMemo(() => {
    if (!sort) return props.rows;
    const column = props.columns.find((candidate) => candidate.key === sort.key);
    if (!column) return props.rows;
    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...props.rows].sort((a, b) => direction * compareRows(a, b, column));
  }, [props.columns, props.rows, sort]);

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? {
            key,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
          }
        : { key, direction: 'asc' },
    );
  }

  return (
    <DataTableBase {...props} rows={sortedRows} sort={sort} mode="client" onSort={toggleSort} />
  );
}
