import { describe, it, expect } from 'vitest';
import { parseCsv, autoDetectMapping, HOLDING_FIELD_ALIASES } from '../csvParser';

describe('parseCsv', () => {
  it('parses simple CSV with headers and rows', () => {
    const csv = 'ticker,shares\nAAPL,10\nTSLA,5';
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(['ticker', 'shares']);
    expect(rows).toEqual([
      { ticker: 'AAPL', shares: '10' },
      { ticker: 'TSLA', shares: '5' },
    ]);
  });

  it('strips UTF-8 BOM prefix (regression: #27 Excel exports)', () => {
    // Excel prepends \uFEFF to UTF-8 CSV exports. Without stripping, the
    // first header becomes "\uFEFFticker" and auto-detect silently misses
    // it, leaving users unable to map their first column.
    const csv = '\uFEFFticker,shares\nAAPL,10';
    const { headers, rows } = parseCsv(csv);
    expect(headers[0]).toBe('ticker'); // BOM stripped
    expect(rows[0]).toEqual({ ticker: 'AAPL', shares: '10' });
  });

  it('auto-detect still matches aliases after BOM stripping', () => {
    const csv = '\uFEFFsymbol,quantity\nAAPL,10';
    const { headers } = parseCsv(csv);
    const mapping = autoDetectMapping(headers, HOLDING_FIELD_ALIASES);
    // "symbol" should map to "ticker"; the BOM-stripped header allows it.
    expect(mapping.symbol).toBe('ticker');
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,shares\n"Apple, Inc.",10';
    const { rows } = parseCsv(csv);
    expect(rows[0].name).toBe('Apple, Inc.');
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    const csv = 'name,shares\n"He said ""hi""",1';
    const { rows } = parseCsv(csv);
    expect(rows[0].name).toBe('He said "hi"');
  });

  it('ignores entirely blank lines', () => {
    const csv = 'a,b\n1,2\n\n3,4';
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });
});
