import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatCurrency, formatSignedCurrency, formatPercent } from '../utils/formatters';
import { COMPARE_PERIODS, findStartSnapshot } from '../utils/snapshotPeriods';
import type { ComparePeriodId } from '../utils/snapshotPeriods';

interface PeriodRow {
  id: ComparePeriodId;
  label: string;
  startNw: number | null;
  currentNw: number;
  deltaAmount: number | null;
  deltaPercent: number | null;
}

/**
 * Phase 4.2 — Portfolio comparison widget.
 *
 * Dense table on the Dashboard: one row per period (1W / 1M / 3M / YTD /
 * 1Y / ALL) showing net worth then, current net worth, dollar delta,
 * and percent delta.
 *
 * Uses findStartSnapshot for "closest snapshot at or before period start".
 * Periods that don't have enough history yet show "—" rather than
 * misleading numbers calculated against today's value.
 */
export function PortfolioComparisonWidget() {
  const { snapshots, netWorthSummary } = usePortfolioContext();
  const currentNw = netWorthSummary.totalNetWorth.amount;

  const rows = useMemo<PeriodRow[]>(() => {
    return COMPARE_PERIODS.map((p) => {
      const startSnap = findStartSnapshot(snapshots, p.id);
      const startNw = startSnap?.netWorthValue ?? null;
      const deltaAmount = startNw !== null ? currentNw - startNw : null;
      const deltaPercent =
        startNw !== null && startNw > 0 ? ((currentNw - startNw) / startNw) * 100 : null;
      return {
        id: p.id,
        label: p.label,
        startNw,
        currentNw,
        deltaAmount,
        deltaPercent,
      };
    });
  }, [snapshots, currentNw]);

  // Hide the widget entirely when no snapshots exist yet — there's nothing
  // meaningful to compare against until a few days have accumulated.
  if (snapshots.length === 0) return null;

  return (
    <div className="mv2-card mv2-card-pad mb-6">
      <h3 className="text-sm font-semibold text-t-primary mb-3">Net worth comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[11px] font-semibold text-t-muted uppercase tracking-wider border-b border-b-default">
              <th className="pb-2 pr-2">Period</th>
              <th className="pb-2 pr-2 text-right">Then</th>
              <th className="pb-2 pr-2 text-right">Now</th>
              <th className="pb-2 pr-2 text-right">Δ$</th>
              <th className="pb-2 text-right">Δ%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const trend = r.deltaAmount === null ? 'flat' : r.deltaAmount > 0 ? 'up' : r.deltaAmount < 0 ? 'down' : 'flat';
              const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
              const trendColor = trend === 'up' ? 'text-gain' : trend === 'down' ? 'text-loss' : 'text-t-faint';
              return (
                <tr key={r.id} className="border-b border-b-subtle last:border-0">
                  <td className="py-1.5 pr-2 font-medium text-t-secondary">{r.label}</td>
                  <td className="py-1.5 pr-2 text-right text-t-secondary tabular-nums">
                    {r.startNw !== null ? formatCurrency(r.startNw) : <span className="text-t-faint">—</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-t-primary tabular-nums">
                    {formatCurrency(r.currentNw)}
                  </td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${trendColor}`}>
                    {r.deltaAmount !== null ? (
                      <span className="inline-flex items-center justify-end gap-0.5">
                        <TrendIcon className="w-3 h-3" aria-hidden="true" />
                        {formatSignedCurrency(r.deltaAmount)}
                      </span>
                    ) : (
                      <span className="text-t-faint">—</span>
                    )}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${trendColor}`}>
                    {r.deltaPercent !== null ? (
                      formatPercent(r.deltaPercent)
                    ) : (
                      <span className="text-t-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
