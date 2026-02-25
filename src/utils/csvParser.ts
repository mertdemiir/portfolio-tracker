/**
 * Parse a CSV string into headers and row objects.
 * Handles quoted fields with commas and escaped quotes.
 */
export function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = splitCsvLines(csvText);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    if (values.every((v) => v.trim() === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of normalized) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  values.push(current.trim());
  return values;
}

export const HOLDING_FIELD_ALIASES: Record<string, string[]> = {
  ticker: ['symbol', 'ticker', 'stock symbol', 'security symbol', 'sym'],
  name: ['name', 'description', 'security name', 'company name', 'security description', 'stock name'],
  shares: ['shares', 'quantity', 'qty', 'units', 'amount', 'shares/units'],
  buyPrice: ['buy price', 'cost basis per share', 'avg cost', 'average cost', 'cost per share', 'price paid', 'purchase price', 'cost/share'],
  buyDate: ['buy date', 'date acquired', 'acquisition date', 'purchase date', 'date purchased', 'date'],
  assetType: ['asset type', 'type', 'security type', 'asset class'],
  category: ['category', 'asset category'],
};

export const TRANSACTION_FIELD_ALIASES: Record<string, string[]> = {
  date: ['date', 'trade date', 'transaction date', 'settlement date'],
  ticker: ['symbol', 'ticker', 'stock symbol', 'security symbol'],
  name: ['name', 'description', 'security name', 'security description'],
  type: ['type', 'action', 'transaction type', 'buy/sell', 'side'],
  shares: ['shares', 'quantity', 'qty', 'units', 'amount'],
  pricePerShare: ['price', 'price per share', 'unit price', 'execution price', 'trade price'],
  total: ['total', 'amount', 'net amount', 'gross amount', 'total cost', 'proceeds'],
  notes: ['notes', 'memo', 'comments'],
};

export function autoDetectMapping(
  headers: string[],
  aliases: Record<string, string[]>
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const usedFields = new Set<string>();

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    let matched = false;

    for (const [field, fieldAliases] of Object.entries(aliases)) {
      if (usedFields.has(field)) continue;
      if (fieldAliases.some((alias) => normalized === alias || normalized.includes(alias))) {
        mapping[header] = field;
        usedFields.add(field);
        matched = true;
        break;
      }
    }

    if (!matched) {
      mapping[header] = null;
    }
  }

  return mapping;
}
