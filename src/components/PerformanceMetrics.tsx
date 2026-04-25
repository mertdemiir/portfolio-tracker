import { useMemo } from 'react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatPercent, formatCurrency } from '../utils/formatters';
import { parseLocalDate } from '../utils/dateHelpers';
import type { PortfolioSnapshot, EnrichedHolding } from '../types';

/**
 * CAGR = (endValue / startValue)^(1/years) - 1
 *
 * Uses the first historical snapshot as the start point and the current
 * live value as the end point.  This avoids dependence on today's
 * mutable snapshot (which is overwritten on every price update) and
 * gives a stable, accurate number.
 *
 * Requires ≥ 30 days of history to avoid meaninglessly volatile results.
 */
function computeCAGR(
  snapshots: PortfolioSnapshot[],
  currentValue: number,
  field: 'portfolioValue' | 'netWorth',
): number | null {
  if (currentValue <= 0) return null;

  const usable = snapshots.filter((s) =>
    field === 'portfolioValue'
      ? s.portfolioValue != null && s.portfolioValue > 0
      : (s.netWorthValue ?? s.totalValue) > 0,
  );
  if (usable.length === 0) return null;

  const sorted = [...usable].sort((a, b) => a.date.localeCompare(b.date));
  const startSnap = sorted[0];
  const startValue =
    field === 'portfolioValue'
      ? startSnap.portfolioValue!
      : (startSnap.netWorthValue ?? startSnap.totalValue);

  if (startValue <= 0) return null;

  const startDate = parseLocalDate(startSnap.date);
  if (isNaN(startDate.getTime())) return null;
  const now = new Date();
  const days = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 30) return null; // need ≥ 30 days for a meaningful annualised rate

  const years = days / 365.25;
  return (Math.pow(currentValue / startValue, 1 / years) - 1) * 100;
}

function getBestWorst(holdings: EnrichedHolding[]) {
  if (holdings.length === 0) return { best: null, worst: null };
  const sorted = [...holdings].sort((a, b) => b.gainLossPercent - a.gainLossPercent);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function PerformanceMetrics() {
  const {
    filteredPortfolioSummary,
    filteredEnrichedHoldings,
    snapshots,
    netWorthSummary,
  } = usePortfolioContext();

  // Hooks must run unconditionally — the rules-of-hooks fix moves the
  // empty-state guard below the useMemo calls.
  const portfolioCagr = useMemo(
    () => computeCAGR(snapshots, filteredPortfolioSummary.totalValue.amount, 'portfolioValue'),
    [snapshots, filteredPortfolioSummary.totalValue.amount],
  );

  const nwCagr = useMemo(
    () => computeCAGR(snapshots, netWorthSummary.totalNetWorth.amount, 'netWorth'),
    [snapshots, netWorthSummary.totalNetWorth.amount],
  );

  if (filteredEnrichedHoldings.length === 0) return null;

  const displayCagr = portfolioCagr ?? nwCagr;
  const { best, worst } = getBestWorst(filteredEnrichedHoldings);

  return (
    <div className="bg-surface-card card-radius border border-b-default p-5 mb-6">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Performance</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Return */}
        <div className="border-l-2 border-l-accent pl-3 hover:scale-[1.02] transition-transform">
          <span className="text-xs text-t-muted font-medium">Total Return</span>
          <p
            className={`text-lg font-bold tabular-nums ${
              filteredPortfolioSummary.totalGainLossPercent >= 0 ? 'text-gain' : 'text-loss'
            }`}
          >
            {formatPercent(filteredPortfolioSummary.totalGainLossPercent)}
          </p>
          <p className="text-xs text-t-faint tabular-nums">
            {filteredPortfolioSummary.totalGainLoss.amount >= 0 ? '+' : ''}
            {formatCurrency(filteredPortfolioSummary.totalGainLoss)}
          </p>
        </div>

        {/* CAGR */}
        <div className="border-l-2 border-l-violet-500 pl-3 hover:scale-[1.02] transition-transform">
          <span className="text-xs text-t-muted font-medium">CAGR</span>
          {displayCagr !== null ? (
            <>
              <p
                className={`text-lg font-bold tabular-nums ${displayCagr >= 0 ? 'text-gain' : 'text-loss'}`}
              >
                {formatPercent(displayCagr)}
              </p>
              <p className="text-xs text-t-faint">Annualized</p>
            </>
          ) : (
            <p className="text-sm text-t-faint mt-1">Need more data</p>
          )}
        </div>

        {/* Best Performer */}
        <div className="border-l-2 border-l-gain pl-3 hover:scale-[1.02] transition-transform">
          <span className="text-xs text-t-muted font-medium">Best Performer</span>
          {best ? (
            <>
              <p className="text-lg font-bold text-gain">{best.ticker}</p>
              <p className="text-xs text-gain/70 tabular-nums">{formatPercent(best.gainLossPercent)}</p>
            </>
          ) : (
            <p className="text-sm text-t-faint">-</p>
          )}
        </div>

        {/* Worst Performer */}
        <div className="border-l-2 border-l-loss pl-3 hover:scale-[1.02] transition-transform">
          <span className="text-xs text-t-muted font-medium">Worst Performer</span>
          {worst ? (
            <>
              <p className="text-lg font-bold text-loss">{worst.ticker}</p>
              <p className="text-xs text-loss/70 tabular-nums">{formatPercent(worst.gainLossPercent)}</p>
            </>
          ) : (
            <p className="text-sm text-t-faint">-</p>
          )}
        </div>
      </div>
    </div>
  );
}
