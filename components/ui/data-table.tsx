import { DataTableBase, type DataTableProps } from '@/components/ui/data-table-base';
import { DataTableClient } from '@/components/ui/data-table-client';

export type {
  Column,
  DataTableProps,
  SortDirection,
  SortState,
} from '@/components/ui/data-table-base';

export function DataTable<T>(props: DataTableProps<T>) {
  if (props.defaultSort !== undefined && props.sortHref === undefined) {
    return <DataTableClient {...props} />;
  }
  return <DataTableBase {...props} />;
}
