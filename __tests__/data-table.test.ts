import { describe, expect, it } from 'vitest';
import { compareRows, type Column } from '@/components/ui/data-table-base';
import { pageItems } from '@/components/ui/pagination';

type Row = { name: string; count: number };

const nameColumn: Column<Row> = {
  key: 'name',
  header: 'Nimi',
  cell: (row) => row.name,
  sortValue: (row) => row.name,
};

const countColumn: Column<Row> = {
  key: 'count',
  header: 'Määrä',
  cell: (row) => row.count,
  sortValue: (row) => row.count,
};

describe('compareRows', () => {
  it('sorts numbers numerically', () => {
    expect(compareRows({ name: 'a', count: 2 }, { name: 'b', count: 10 }, countColumn)).toBeLessThan(
      0,
    );
    expect(
      compareRows({ name: 'a', count: 10 }, { name: 'b', count: 2 }, countColumn),
    ).toBeGreaterThan(0);
  });

  it('sorts strings with the Finnish locale and numeric awareness', () => {
    expect(compareRows({ name: 'Aatu', count: 0 }, { name: 'Bea', count: 0 }, nameColumn)).toBeLessThan(
      0,
    );
    expect(compareRows({ name: '2', count: 0 }, { name: '10', count: 0 }, nameColumn)).toBeLessThan(
      0,
    );
  });

  it('falls back to the row property when no sortValue is given', () => {
    const column: Column<Row> = { key: 'name', header: 'Nimi', cell: (row) => row.name };
    expect(compareRows({ name: 'a', count: 0 }, { name: 'b', count: 0 }, column)).toBeLessThan(0);
  });
});

describe('pageItems', () => {
  it('returns no items when there are no pages', () => {
    expect(pageItems(1, 0)).toEqual([]);
  });

  it('lists every page when there are at most seven', () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('shows a leading window near the start', () => {
    expect(pageItems(2, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
  });

  it('shows a trailing window near the end', () => {
    expect(pageItems(19, 20)).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
  });

  it('centres the current page in the middle', () => {
    expect(pageItems(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });
});
