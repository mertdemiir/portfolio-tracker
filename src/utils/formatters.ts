// Module-level base currency for formatters
let _baseCurrency = 'USD';

export function setGlobalBaseCurrency(currency: string) {
  _baseCurrency = currency;
}

export function getBaseCurrency(): string {
  return _baseCurrency;
}

export function formatCurrency(value: number, currency?: string): string {
  const cur = currency || _baseCurrency;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedCurrency(value: number, currency?: string): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatCurrency(value, currency)}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCompactCurrency(value: number, currency?: string): string {
  const cur = currency || _baseCurrency;
  const symbol = getCurrencySymbol(cur);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(value, cur);
}

/** Get the currency symbol for the current base currency */
export function getBaseCurrencySymbol(): string {
  return getCurrencySymbol(_baseCurrency);
}

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value || '$';
  } catch {
    return '$';
  }
}
