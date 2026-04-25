import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus, Minus, Activity } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatSignedCurrency, formatPercent, todayDateString } from '../utils/formatters';
import type { Transaction, EnrichedHolding, TabId } from '../types';
import type { NavFilter } from '../App';

interface WhatChangedTodayCardProps {
  onNavigate?: (tab: TabId, filter?: NavFilter) => void;
}

/**
 * Phase 4.4 — "What changed today?" Dashboard card.
 *
 * Surfaces transaction-level events that DailyDigest doesn't cover:
 *   - positions opened today (first-ever buy of a ticker)
 *   - positions closed today (final sell brought shares to zero)
 *   - txn counts by type
 *   - top 3 dollar movers today
 *   - top 3 percent movers today
 *
 * Hides itself if nothing of substance happened today (no txns and no
 * non-zero dailyChange) so it doesn't waste vertical space.
 */
export function WhatChangedTodayCard({ onNavigate }: WhatChangedTodayCardProps) {
  const { transactions, allEnrichedHoldings } = usePortfolioContext();
  const today = todayDateString();

  const summary = useMemo(() => buildSummary(transactions, allEnrichedHoldings, today), [
    transactions,
    allEnrichedHoldings,
    today,
  ]);

  // Hide entirely when there's nothing to show — don't burn vertical space
  // on a half-empty card.
  if (
    summary.todaysTxns.length === 0 &&
    summary.dollarMovers.length === 0 &&
    summary.percentMovers.length === 0
  ) {
    return null;
  }

  return (
    <div className="bg-surface-card card-radius border border-b-default p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-t-primary">What changed today</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        {/* Transaction activity */}
        {summary.todaysTxns.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-t-muted uppercase tracking-wider mb-2">
              Transactions today ({summary.todaysTxns.length})
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(summary.byType)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => (
                  <span
                    key={type}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-surface-alt text-t-secondary capitalize"
                  >
                    {count}× {type}
                  </span>
                ))}
            </div>
            {(summary.opened.length > 0 || summary.closed.length > 0) && (
              <div className="space-y-1.5 text-xs">
                {summary.opened.map((t) => (
                  <button
                    key={`open-${t.id}`}
                    type="button"
                    onClick={() =>
                      onNavigate?.('transactions', { ticker: t.ticker })
                    }
                    className="flex items-center gap-1.5 text-gain hover:underline w-full text-left"
                    title={`Opened ${t.shares} ${t.ticker}`}
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                    Opened <span className="font-semibold">{t.ticker}</span>
                    <span className="text-t-muted ml-1 tabular-nums">
                      {t.shares} sh
                    </span>
                  </button>
                ))}
                {summary.closed.map((t) => (
                  <button
                    key={`close-${t.id}`}
                    type="button"
                    onClick={() =>
                      onNavigate?.('transactions', { ticker: t.ticker })
                    }
                    className="flex items-center gap-1.5 text-loss hover:underline w-full text-left"
                    title={`Closed ${t.ticker}`}
                  >
                    <Minus className="w-3 h-3" aria-hidden="true" />
                    Closed <span className="font-semibold">{t.ticker}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dollar movers */}
        {summary.dollarMovers.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-t-muted uppercase tracking-wider mb-2">
              Biggest $ movers
            </p>
            <ul className="space-y-1">
              {summary.dollarMovers.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-t-primary">{h.ticker}</span>
                  <span
                    className={`tabular-nums ${
                      h.dailyChange.amount >= 0 ? 'text-gain' : 'text-loss'
                    }`}
                  >
                    {h.dailyChange.amount >= 0 ? (
                      <ArrowUpRight className="inline w-3 h-3 mr-0.5" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="inline w-3 h-3 mr-0.5" aria-hidden="true" />
                    )}
                    {formatSignedCurrency(h.dailyChange)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Percent movers */}
        {summary.percentMovers.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-t-muted uppercase tracking-wider mb-2">
              Biggest % movers
            </p>
            <ul className="space-y-1">
              {summary.percentMovers.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-t-primary">{h.ticker}</span>
                  <span
                    className={`tabular-nums ${
                      h.dailyChangePercent >= 0 ? 'text-gain' : 'text-loss'
                    }`}
                  >
                    {formatPercent(h.dailyChangePercent)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface DaySummary {
  todaysTxns: Transaction[];
  byType: Record<string, number>;
  opened: Transaction[];
  closed: Transaction[];
  dollarMovers: EnrichedHolding[];
  percentMovers: EnrichedHolding[];
}

function buildSummary(
  transactions: Transaction[],
  holdings: EnrichedHolding[],
  today: string,
): DaySummary {
  const todaysTxns = transactions.filter((t) => t.date === today);

  // Count by type for the chip row.
  const byType: Record<string, number> = {};
  for (const t of todaysTxns) {
    byType[t.type] = (byType[t.type] ?? 0) + 1;
  }

  // Opened today: a buy whose ticker had no earlier txn in the same portfolio.
  // Closed today: a sell whose ticker now has zero remaining holdings — we
  // approximate by checking if the holdings list has it (if not, it was closed).
  const earlierByKey = new Set<string>();
  for (const t of transactions) {
    if (t.date < today && (t.type === 'buy' || t.type === 'sell')) {
      earlierByKey.add(`${t.ticker.toUpperCase()}::${t.portfolioId}`);
    }
  }
  const opened = todaysTxns.filter((t) => {
    if (t.type !== 'buy') return false;
    return !earlierByKey.has(`${t.ticker.toUpperCase()}::${t.portfolioId}`);
  });

  const liveHoldingTickers = new Set(holdings.map((h) => `${h.ticker.toUpperCase()}::${h.portfolioId}`));
  const closed = todaysTxns.filter((t) => {
    if (t.type !== 'sell') return false;
    return !liveHoldingTickers.has(`${t.ticker.toUpperCase()}::${t.portfolioId}`);
  });

  // Top 3 by absolute dollar daily change. Skip zero-change entries to avoid
  // padding the list with stale or untraded positions.
  const dollarMovers = [...holdings]
    .filter((h) => h.dailyChange.amount !== 0)
    .sort((a, b) => Math.abs(b.dailyChange.amount) - Math.abs(a.dailyChange.amount))
    .slice(0, 3);

  // Top 3 by absolute percent daily change. Same skip rule.
  const percentMovers = [...holdings]
    .filter((h) => h.dailyChangePercent !== 0)
    .sort((a, b) => Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))
    .slice(0, 3);

  return { todaysTxns, byType, opened, closed, dollarMovers, percentMovers };
}
