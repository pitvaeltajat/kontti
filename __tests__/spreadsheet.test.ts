import { describe, expect, it } from 'vitest';
import { buildXlsx, toCsv } from '@/lib/spreadsheet';

describe('toCsv', () => {
  it('adds a UTF-8 BOM and quotes values with commas, quotes or newlines', () => {
    const csv = toCsv([
      ['Nimi', 'Lisätiedot'],
      ['Aatu "Vaelta"', 'gluteeniton, maidoton'],
      ['Bea', 'rivi 1\nrivi 2'],
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Aatu ""Vaelta"""');
    expect(csv).toContain('"gluteeniton, maidoton"');
    expect(csv).toContain('"rivi 1\nrivi 2"');
  });
});

describe('buildXlsx', () => {
  it('builds a stored ZIP workbook with the sheet XML and cell values', () => {
    const bytes = buildXlsx(
      [
        ['Nimi', 'Sähköposti'],
        ['Aatu', 'aatu@example.com'],
      ],
      'Ilmoittautuneet',
    );
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('Ilmoittautuneet');
    expect(text).toContain('Aatu');
    expect(text).toContain('aatu@example.com');
  });
});
