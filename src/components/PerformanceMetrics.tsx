import { usePortfolioContext } from '../context/PortfolioContext';
import { formatPercent, formatCurrency } from '../utils/formatters';
import type { PortfolioSnapshot, EnrichedHolding } from '../types';

function computeCAGR(snapshots: PortfolioSnapshot[]): number | null {
  const withPortfolio = snapshots.filter((s) => s.portfolioValue != null);
  if (withPortfolio.length < 2) return null;
  const sorted = [...withPortfolio].sort((a, b) => a.date.localeCompare(b.date));
  const startValue = sorted[0].portfolioValue!;
  const endValue = sorted[sorted.length - 1].portfolioValue!;
  if (startValue <= 0) return null;
  const days =
    (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) /
    (1000 * 60 * 60 * 24);
  if (days < 1) return null;
  const years = days / 365.25;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

function computeNWCAGR(snapshots: PortfolioSnapshot[]): number | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const startValue = sorted[0].netWorthValue ?? sorted[0].totalValue;
  const endValue = sorted[sorted.length - 1].netWorthValue ?? sorted[sorted.length - 1].totalValue;
  if (!startValue || !endValue || startValue <= 0) return null;
  const days =
    (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[0].date).getTime()) /
    (1000 * 60 * 60 * 24);
  if (days < 1) return null;
  const years = days / 365.25;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

function getBestWorst(holdings: EnrichedHolding[]) {
  if (holdings.length === 0) return { best: null, worst: null };
  const sorted = [...holdings].sort((a, b) => b.gainLossPercent - a.gainLossPercent);
  return { best: sorted[0], worst: sorted[sorted.length - 1] };
}

export function PerformanceMetrics() {
  const { filteredPortfolioSummary, filteredEnrichedHoldings, snapshots } = usePortfolioContext();

  if (filteredEnrichedHoldings.length === 0) return null;

  const cagr = computeCAGR(snapshots);
  const nwCagr = computeNWCAGR(snapshots);
  const displayCagr = cagr ?? nwCagr;
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
            {filteredPortfolioSummary.totalGainLoss >= 0 ? '+' : ''}
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
