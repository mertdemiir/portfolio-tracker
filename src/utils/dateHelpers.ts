/**
 * Local-timezone-safe date utilities.
 *
 * The JS `Date` constructor treats "YYYY-MM-DD" strings as UTC midnight.
 * When a user in a non-UTC timezone then formats that date for display, it
 * can shift by a day — e.g. "2026-01-01" rendered in America/Los_Angeles
 * becomes "Dec 31, 2025". All date strings in this app are stored as
 * YYYY-MM-DD representing a local calendar day, so we parse them with the
 * explicit numeric-args constructor to avoid the UTC interpretation.
 *
 * Rule: any code that converts a user-facing YYYY-MM-DD string into a Date
 * should go through `parseLocalDate`. Raw `new Date(str)` on a date string
 * is a bug.
 */

/**
 * Parse "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm:ss") into a Date at local
 * midnight. Returns an invalid Date (`isNaN(date.getTime())`) if the input
 * doesn't start with a valid YYYY-MM-DD prefix.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const [datePart] = dateStr.split('T');
  const parts = datePart.split('-');
  if (parts.length < 3) return new Date(NaN);
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

/** Format YYYY-MM-DD as "MMM d" (e.g. "Jan 5"). Safe across timezones. */
export function formatMonthDay(dateStr: string, locale = 'en-US'): string {
  const date = parseLocalDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/** Format YYYY-MM-DD as "MMM yyyy" (e.g. "Jan 2026"). */
export function formatMonthYear(dateStr: string, locale = 'en-US'): string {
  const date = parseLocalDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

/** Format YYYY-MM-DD as "MMM d, yyyy" (e.g. "Jan 5, 2026"). */
export function formatLongDate(dateStr: string, locale = 'en-US'): string {
  const date = parseLocalDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format YYYY-MM-DD as "MMM 'yy" (short year) for dense charts. */
export function formatMonthShortYear(dateStr: string, locale = 'en-US'): string {
  const date = parseLocalDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

/** Return a Date `days` ahead (or behind, if negative) of the given YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Return today's YYYY-MM-DD in the local timezone. */
export function todayLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
