import { todayDateString } from './formatters';
import type { PortfolioSnapshot } from '../types';

export type ComparePeriodId = '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export interface ComparePeriod {
  id: ComparePeriodId;
  label: string;
}

export const COMPARE_PERIODS: ComparePeriod[] = [
  { id: '1W', label: '1W' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
  { id: 'YTD', label: 'YTD' },
  { id: '1Y', label: '1Y' },
  { id: 'ALL', label: 'ALL' },
];

/**
 * Returns the ISO yyyy-mm-dd string for the start of the given period.
 *
 *   1W  → 7 days ago
 *   1M  → 1 calendar month ago (same day-of-month, clamping for short months)
 *   3M  → 3 calendar months ago
 *   YTD → Jan 1 of this year
 *   1Y  → 1 year ago
 *   ALL → null (caller uses earliest snapshot instead)
 */
export function startDateForPeriod(period: ComparePeriodId, todayLocalIso = todayDateString()): string | null {
  if (period === 'ALL') return null;
  const [y, m, d] = todayLocalIso.split('-').map(Number);
  const today = new Date(y, m - 1, d);

  if (period === 'YTD') {
    return `${y}-01-01`;
  }
  const dt = new Date(today);
  switch (period) {
    case '1W': dt.setDate(dt.getDate() - 7); break;
    case '1M': dt.setMonth(dt.getMonth() - 1); break;
    case '3M': dt.setMonth(dt.getMonth() - 3); break;
    case '1Y': dt.setFullYear(dt.getFullYear() - 1); break;
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * Find the snapshot closest to (and on or before) the given target date.
 * Returns null if no snapshot exists at or before the target.
 *
 * The "on or before" rule matters for periods like 1W: if the user has
 * snapshots only on weekdays and 7 days ago was a Sunday, we want last
 * Friday's snapshot — not next Monday's.
 */
export function findSnapshotOnOrBefore(
  snapshots: PortfolioSnapshot[],
  targetDate: string,
): PortfolioSnapshot | null {
  let best: PortfolioSnapshot | null = null;
  for (const s of snapshots) {
    if (s.date <= targetDate) {
      if (!best || s.date > best.date) best = s;
    }
  }
  return best;
}

/**
 * For ALL, returns the earliest snapshot. For other periods, returns the
 * snapshot at or before the period start date.
 */
export function findStartSnapshot(
  snapshots: PortfolioSnapshot[],
  period: ComparePeriodId,
): PortfolioSnapshot | null {
  if (period === 'ALL') {
    if (snapshots.length === 0) return null;
    return [...snapshots].sort((a, b) => a.date.localeCompare(b.date))[0];
  }
  const target = startDateForPeriod(period);
  if (!target) return null;
  return findSnapshotOnOrBefore(snapshots, target);
}
