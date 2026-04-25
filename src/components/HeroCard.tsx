import { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatCurrency, formatSignedCurrency, formatPercent, formatCompactCurrency } from '../utils/formatters';
import type { TimeRange } from '../types';

const RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

const PERIOD_LABEL: Record<TimeRange, string> = {
  '1M': 'past 30 days',
  '3M': 'past 3 months',
  '6M': 'past 6 months',
  '1Y': 'past year',
  'ALL': 'all-time',
};

interface TryToggleProps {
  active: boolean;
  rate: number; // base currency → TRY
  onToggle: () => void;
}

interface HeroCardProps {
  /**
   * Optional TRY toggle. When provided, shows a small ₺ chip next to the
   * "Total Net Worth" label and (when active) renders the value in TRY.
   * Hidden when `undefined` — i.e. when the user's base currency is TRY.
   */
  tryToggle?: TryToggleProps;
}

/**
 * Mercury HeroCard — replaces the old Dashboard P&L strip.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  TOTAL NET WORTH                          [1M 3M 6M 1Y ALL] │
 *   │  $XXX,XXX            (Fraunces 60px)                         │
 *   │  +$X (+X%)  past N days                  low $X · high $X    │
 *   │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄    │
 *   │  ┄┄┄┄┄┄┄watermark area chart of NW snapshots┄┄┄┄┄┄┄┄┄┄┄┄    │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  ASSETS │ LIABILITIES │ PORTFOLIO │ TODAY                     │
 *   │  $X     │ −$X         │ $X (N hldgs) │ +$X (+X%)              │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * The chart is rendered as a 55%-opacity watermark behind the text,
 * with a top mask-fade so the value/delta stays legible. Dashed
 * cost-basis reference line if available.
 */
export function HeroCard({ tryToggle }: HeroCardProps = {}) {
  const {
    netWorthSummary,
    filteredPortfolioSummary,
    filteredEnrichedHoldings,
    snapshots,
  } = usePortfolioContext();

  const [range, setRange] = useLocalStorage<TimeRange>('chart-time-range', 'ALL');

  // Slice snapshots to the chosen range.
  const { sliced, deltaAmt, deltaPct, low, high } = useMemo(() => {
    if (snapshots.length === 0) {
      return { sliced: [], deltaAmt: 0, deltaPct: 0, low: 0, high: 0 };
    }
    const rangeDays: Record<TimeRange, number> = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      'ALL': snapshots.length,
    };
    const days = Math.min(rangeDays[range], snapshots.length);
    const slicedRaw = [...snapshots].sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
    const first = slicedRaw[0]?.netWorthValue ?? 0;
    const last = slicedRaw.at(-1)?.netWorthValue ?? 0;
    const values = slicedRaw.map((s) => s.netWorthValue ?? s.totalValue);
    return {
      sliced: slicedRaw.map((s) => ({ value: s.netWorthValue ?? s.totalValue, date: s.date })),
      deltaAmt: last - first,
      deltaPct: first > 0 ? ((last - first) / first) * 100 : 0,
      low: values.length > 0 ? Math.min(...values) : 0,
      high: values.length > 0 ? Math.max(...values) : 0,
    };
  }, [snapshots, range]);

  // Cost basis reference line — pulled from the active filtered summary.
  const costBasis = filteredPortfolioSummary.totalCostBasis.amount;
  const totalDailyChange = filteredPortfolioSummary.totalDailyChange;
  const totalDailyPct = filteredPortfolioSummary.totalDailyChangePercent;

  const periodLabel = PERIOD_LABEL[range];
  const positive = deltaAmt >= 0;
  const todayPositive = totalDailyChange.amount >= 0;

  return (
    <div className="mv2-hero">
      {/* Watermark chart layer (only renders when we have a few datapoints) */}
      {sliced.length >= 2 && (
        <div className="mv2-hero-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mv2-hero-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              {costBasis > 0 && (
                <ReferenceLine
                  y={costBasis}
                  stroke="var(--text-muted)"
                  strokeDasharray="3 4"
                  strokeWidth={1}
                  label={{
                    value: `cost basis · ${formatCompactCurrency(costBasis)}`,
                    position: 'insideBottomLeft',
                    fill: 'var(--text-muted)',
                    fontSize: 10,
                    offset: 8,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={1.6}
                fill="url(#mv2-hero-fill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Foreground content */}
      <div className="mv2-hero-content">
        <div className="mv2-hero-top">
          <div className="mv2-hero-left">
            <div className="m-hero-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Total Net Worth</span>
              {tryToggle && (
                <button
                  type="button"
                  onClick={tryToggle.onToggle}
                  aria-pressed={tryToggle.active}
                  title={tryToggle.active ? 'Show in base currency' : 'Show in TRY'}
                  style={{
                    padding: '1px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 4,
                    background: tryToggle.active ? 'var(--accent)' : 'var(--surface-alt)',
                    color: tryToggle.active ? 'white' : 'var(--text-muted)',
                    border: 0,
                    cursor: 'pointer',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  ₺
                </button>
              )}
            </div>
            <div className="mv2-hero-value tabular">
              {tryToggle?.active
                ? `₺${(netWorthSummary.totalNetWorth.amount * tryToggle.rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalNetWorth)}
            </div>
            {sliced.length >= 2 ? (
              <div className="mv2-hero-delta">
                <span className={'amt ' + (positive ? 'pct-up' : 'pct-down')}>
                  {formatSignedCurrency(deltaAmt)} ({formatPercent(deltaPct)})
                </span>
                <span className="period">{periodLabel}</span>
              </div>
            ) : (
              <div className="mv2-hero-delta">
                <span className="period">Add a few snapshots to see your performance over time.</span>
              </div>
            )}
          </div>

          <div className="mv2-hero-right">
            <div className="mv2-range-pills" role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={range === r ? 'active' : ''}
                  aria-pressed={range === r}
                >
                  {r}
                </button>
              ))}
            </div>
            {sliced.length >= 2 && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                low {formatCompactCurrency(low)} · high {formatCompactCurrency(high)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom strip — always visible, key totals */}
      <div className="mv2-hero-strip">
        <div>
          <div className="m-strip-label">Assets</div>
          <div className="m-strip-val tabular">{formatCurrency(netWorthSummary.totalAssets)}</div>
        </div>
        <div>
          <div className="m-strip-label">Liabilities</div>
          <div className="m-strip-val tabular" style={{ color: 'var(--loss)' }}>
            −{formatCurrency(netWorthSummary.totalLiabilities)}
          </div>
        </div>
        <div>
          <div className="m-strip-label">Portfolio</div>
          <div className="m-strip-val tabular">
            {formatCurrency(filteredPortfolioSummary.totalValue)}
          </div>
          <div className="m-strip-sub">{filteredEnrichedHoldings.length} holdings</div>
        </div>
        <div>
          <div className="m-strip-label">Today</div>
          <div className={'m-strip-val tabular ' + (todayPositive ? 'pct-up' : 'pct-down')}>
            {formatSignedCurrency(totalDailyChange)}
          </div>
          <div className={'m-strip-sub ' + (todayPositive ? 'pct-up' : 'pct-down')}>
            {formatPercent(totalDailyPct)}
          </div>
        </div>
      </div>
    </div>
  );
}
