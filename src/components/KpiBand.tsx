import { useMemo } from 'react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatSignedCurrency, formatPercent, formatCurrency } from '../utils/formatters';
import type { TimeRange, PortfolioSnapshot } from '../types';

const RANGE_LABEL: Record<TimeRange, string> = {
  '1M': '30d',
  '3M': '3mo',
  '6M': '6mo',
  '1Y': '1y',
  'ALL': 'all',
};

const RANGE_DAYS: Record<TimeRange, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  'ALL': Infinity,
};

/**
 * Mercury KpiBand — 4 stat cards below the HeroCard on Dashboard:
 *
 *   ┌─────────────┬─────────────┬─────────────┬─────────────┐
 *   │ UNREALIZED  │ REALIZED    │ RETURN      │ TOTAL P&L   │
 *   │ +$X,XXX     │ +$X,XXX     │ +X.X%       │ +$X,XXX     │
 *   │ +X% vs cost │ closed pos. │ ann. +X.X%  │ unr+real    │
 *   └─────────────┴─────────────┴─────────────┴─────────────┘
 *
 * Reads the same range as HeroCard (the shared 'chart-time-range'
 * localStorage key) so changing the hero's pill switcher recolors the
 * KPI band period labels too.
 */
export function KpiBand() {
  const { filteredPortfolioSummary, realizedPnl, snapshots } = usePortfolioContext();
  const [range] = useLocalStorage<TimeRange>('chart-time-range', 'ALL');

  const ps = filteredPortfolioSummary;
  const unrealized = ps.totalGainLoss;
  const unrealizedPct = ps.totalGainLossPercent;
  const totalPnl = unrealized.amount + realizedPnl;

  const { periodReturnPct, annualizedPct } = useMemo(() =>
    computePeriodReturn(snapshots, range), [snapshots, range]);

  const rangeShort = RANGE_LABEL[range];
  const positiveUnreal = unrealized.amount >= 0;
  const positiveReal = realizedPnl >= 0;
  const positiveReturn = periodReturnPct !== null && periodReturnPct >= 0;
  const positiveTotal = totalPnl >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 mb-6">
      <div className="m-kpi-card">
        <div className="m-kpi-label">Unrealized P&L</div>
        <div className={'m-kpi-val ' + (positiveUnreal ? 'pct-up' : 'pct-down')}>
          {formatSignedCurrency(unrealized)}
        </div>
        <div className={'m-kpi-sub ' + (positiveUnreal ? 'pct-up' : 'pct-down')}>
          {formatPercent(unrealizedPct)} vs cost basis
        </div>
      </div>

      <div className="m-kpi-card">
        <div className="m-kpi-label">Realized P&L</div>
        <div className={'m-kpi-val ' + (positiveReal ? 'pct-up' : 'pct-down')}>
          {formatSignedCurrency(realizedPnl)}
        </div>
        <div className="m-kpi-sub" style={{ color: 'var(--text-muted)' }}>from closed positions</div>
      </div>

      <div className="m-kpi-card">
        <div className="m-kpi-label">Return · {rangeShort}</div>
        <div className={'m-kpi-val ' + (positiveReturn ? 'pct-up' : 'pct-down')}>
          {periodReturnPct !== null ? formatPercent(periodReturnPct) : '—'}
        </div>
        <div className="m-kpi-sub" style={{ color: 'var(--text-muted)' }}>
          {annualizedPct !== null ? `annualized ${formatPercent(annualizedPct)}` : 'need ≥ 30 days'}
        </div>
      </div>

      <div className="m-kpi-card">
        <div className="m-kpi-label">Total P&L</div>
        <div className={'m-kpi-val ' + (positiveTotal ? 'pct-up' : 'pct-down')}>
          {formatSignedCurrency(totalPnl)}
        </div>
        <div className="m-kpi-sub" style={{ color: 'var(--text-muted)' }}>
          cost basis {formatCurrency(ps.totalCostBasis)}
        </div>
      </div>
    </div>
  );
}

/**
 * Period return: NW change over the chosen range, plus a naive
 * annualized projection. Returns nulls when there's not enough
 * snapshot history (< 2 in-range snapshots).
 */
function computePeriodReturn(
  snapshots: PortfolioSnapshot[],
  range: TimeRange,
): { periodReturnPct: number | null; annualizedPct: number | null } {
  if (snapshots.length < 2) return { periodReturnPct: null, annualizedPct: null };
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const days = RANGE_DAYS[range];
  const sliced = days === Infinity ? sorted : sorted.slice(-Math.min(days, sorted.length));
  if (sliced.length < 2) return { periodReturnPct: null, annualizedPct: null };
  const first = sliced[0].netWorthValue ?? sliced[0].totalValue;
  const last = sliced.at(-1)!.netWorthValue ?? sliced.at(-1)!.totalValue;
  if (first <= 0) return { periodReturnPct: null, annualizedPct: null };
  const periodReturnPct = ((last - first) / first) * 100;
  // Naive annualization factor — same as PerformanceMetrics + the
  // Mercury mockup. Skips when range < 30 days (too noisy).
  const factor: Record<TimeRange, number | null> = {
    '1M': null, // 30 days isn't long enough for a meaningful annualization
    '3M': 4,
    '6M': 2,
    '1Y': 1,
    'ALL': null, // ALL handled below
  };
  let annualizedPct: number | null = null;
  if (range === 'ALL') {
    const firstDate = new Date(sliced[0].date);
    const lastDate = new Date(sliced.at(-1)!.date);
    const years = (lastDate.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years > 0.08 /* ~ 1 month */) {
      annualizedPct = periodReturnPct / years;
    }
  } else if (factor[range] !== null) {
    annualizedPct = periodReturnPct * (factor[range] as number);
  }
  return { periodReturnPct, annualizedPct };
}
