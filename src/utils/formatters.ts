// Module-level base currency for formatters
let _baseCurrency = 'USD';

export function setGlobalBaseCurrency(currency: string) {
  _baseCurrency = currency;
}

export function getBaseCurrency(): string {
  return _baseCurrency;
}

/**
 * Money-aware type sniff. We can't import Money directly here without
 * creating a cycle (money.ts → types → formatters), so we structurally
 * test for the { amount, currency } shape.
 */
function isMoney(v: unknown): v is { amount: number; currency: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { amount?: unknown }).amount === 'number' &&
    typeof (v as { currency?: unknown }).currency === 'string'
  );
}

/**
 * Formats a currency value. Accepts either a raw number (uses the passed
 * currency or the global base) or a Money value (uses the money's own
 * currency tag, ignoring the second arg). The Money overload is the
 * recommended path for new code — it makes cross-currency bugs into
 * compile errors upstream.
 */
export function formatCurrency(
  value: number | { amount: number; currency: string },
  currency?: string,
): string {
  let amount: number;
  let cur: string;
  if (isMoney(value)) {
    amount = value.amount;
    cur = value.currency;
  } else {
    amount = value;
    cur = currency || _baseCurrency;
  }
  const safeValue = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function formatPercent(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue >= 0 ? '+' : '';
  return `${sign}${safeValue.toFixed(2)}%`;
}

export function formatSignedCurrency(
  value: number | { amount: number; currency: string },
  currency?: string,
): string {
  const amount = isMoney(value) ? value.amount : value;
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${formatCurrency(value, currency)}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  // Use local-date constructor to avoid UTC timezone shift
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCompactCurrency(
  value: number | { amount: number; currency: string },
  currency?: string,
): string {
  const amount = isMoney(value) ? value.amount : value;
  const cur = isMoney(value) ? value.currency : currency || _baseCurrency;
  if (!Number.isFinite(amount)) return formatCurrency(0, cur);
  const symbol = getCurrencySymbol(cur);
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${symbol}${(abs / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount, cur);
}

/** Get the currency symbol for the current base currency */
export function getBaseCurrencySymbol(): string {
  return getCurrencySymbol(_baseCurrency);
}

export function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCurrencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value || '$';
  } catch {
    return '$';
  }
}
