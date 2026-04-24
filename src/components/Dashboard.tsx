import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Clock, Target, Plus, Trash2, Check, X, Share2, ChevronDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { usePricesFx } from '../context/PricesFxContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { formatCurrency, formatSignedCurrency, formatPercent } from '../utils/formatters';
import { EmptyState } from './EmptyState';
import { AddEditStockModal } from './AddEditStockModal';
import { PerformanceMetrics } from './PerformanceMetrics';
import { DailyDigest } from './DailyDigest';
import { ShareImageModal } from './ShareImageModal';
import { LiabilitiesSection } from './LiabilitiesSection';
import type { NWMilestone, TabId } from '../types';
import type { NavFilter } from '../App';

interface DashboardProps {
  onNavigate?: (tab: TabId, filter?: NavFilter) => void;
}

const CATEGORY_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
];

export function Dashboard({ onNavigate }: DashboardProps) {
  const {
    filteredPortfolioSummary,
    filteredEnrichedHoldings,
    netWorthSummary,
    allEnrichedHoldings,
    activePortfolioId,
    portfolios,
    realizedPnl,
    snapshots,
    addHolding,
  } = usePortfolioContext();
  const { baseCurrency, apiKey } = useSettings();
  const { pricesLoading } = usePricesFx();

  const [milestones, setMilestones] = useLocalStorage<NWMilestone[]>('nw-milestones', []);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTRY, setShowTRY] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(true);
  // Cached 1h TRY conversion — shared across components via localStorage.
  const tryRate = useExchangeRate(baseCurrency, 'TRY');

  // Migrate old single nw-target to milestones
  useEffect(() => {
    const oldTarget = localStorage.getItem('nw-target');
    if (oldTarget && milestones.length === 0) {
      try {
        const val = JSON.parse(oldTarget);
        if (typeof val === 'number' && val > 0) {
          setMilestones([{ id: crypto.randomUUID(), name: 'Net Worth Target', value: val }]);
          localStorage.removeItem('nw-target');
        }
      } catch { /* ignore */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addMilestone() {
    const val = parseFloat(newValue);
    const name = newName.trim() || `$${val.toLocaleString()} milestone`;
    if (!isNaN(val) && val > 0) {
      setMilestones((prev) => [...prev, { id: crypto.randomUUID(), name, value: val }].sort((a, b) => a.value - b.value));
      setNewName('');
      setNewValue('');
      setAddingMilestone(false);
    }
  }

  function deleteMilestone(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  if (allEnrichedHoldings.length === 0) {
    return (
      <>
        <EmptyState onAdd={() => setShowAddModal(true)} />
        {showAddModal && (
          <AddEditStockModal
            apiKey={apiKey}
            onSave={(data) => {
              // buyFxRate is decided inside the modal
              addHolding(data);
              setShowAddModal(false);
            }}
            onClose={() => setShowAddModal(false)}
            // Dashboard empty-state has no edit surface; if the user wants
            // to edit an existing holding, send them to the Holdings tab.
            onEditExisting={() => {
              setShowAddModal(false);
              onNavigate?.('holdings');
            }}
          />
        )}
      </>
    );
  }

  const activeName = activePortfolioId === 'all'
    ? null
    : portfolios.find((p) => p.id === activePortfolioId)?.name;

  const ps = filteredPortfolioSummary;
  // Total P&L combines unrealized (Money) + realized (number, already in
  // base currency from context). We pull .amount for the arithmetic.
  const totalPnlAmount = ps.totalGainLoss.amount + realizedPnl;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-t-primary tracking-tight">Dashboard</h2>
        <div className="flex items-center gap-2">
          {pricesLoading && (
            <span className="text-xs text-t-muted flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-b-input border-t-accent rounded-full animate-spin" />
              Updating...
            </span>
          )}
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 hover:bg-surface-alt rounded-lg transition-colors"
            title="Share as image"
            aria-label="Share as image"
          >
            <Share2 className="w-4 h-4 text-t-muted" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Section A: Net Worth Hero */}
      <div className="bg-surface-card rounded-2xl border border-b-default p-6 mb-6 overflow-hidden">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-t-muted font-medium">Total Net Worth</p>
              {baseCurrency !== 'TRY' && (
                <button
                  onClick={() => setShowTRY((p) => !p)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                    showTRY
                      ? 'bg-accent text-white'
                      : 'bg-surface-alt text-t-muted hover:text-t-secondary'
                  }`}
                >
                  ₺
                </button>
              )}
            </div>
            <p className="text-4xl font-bold text-t-primary tabular-nums tracking-tight">
              {showTRY && tryRate
                ? `₺${(netWorthSummary.totalNetWorth.amount * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalNetWorth)}
            </p>
          </div>
        </div>

        {/* Assets / Liabilities breakdown */}
        {netWorthSummary.totalLiabilities.amount > 0 && (
          <div className="flex gap-6 text-sm mb-4">
            <div>
              <span className="text-t-muted text-xs">Total Assets</span>
              <p className="font-semibold text-gain tabular-nums">
                {showTRY && tryRate
                  ? `₺${(netWorthSummary.totalAssets.amount * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : formatCurrency(netWorthSummary.totalAssets)}
              </p>
            </div>
            <div>
              <span className="text-t-muted text-xs">Liabilities</span>
              <p className="font-semibold text-loss tabular-nums">
                {showTRY && tryRate
                  ? `-₺${(netWorthSummary.totalLiabilities.amount * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : `-${formatCurrency(netWorthSummary.totalLiabilities)}`}
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-t-muted text-xs">Portfolio</span>
            <p className="font-semibold text-t-primary tabular-nums">
              {showTRY && tryRate
                ? `₺${(netWorthSummary.totalPortfolioValue.amount * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalPortfolioValue)}
            </p>
          </div>
          <div>
            <span className="text-t-muted text-xs">Other Assets</span>
            <p className="font-semibold text-t-primary tabular-nums">
              {showTRY && tryRate
                ? `₺${(netWorthSummary.totalNonPortfolioValue.amount * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalNonPortfolioValue)}
            </p>
          </div>
          <div>
            <span className="text-t-muted text-xs">Holdings</span>
            <p className="font-semibold text-t-primary">{netWorthSummary.holdingCount}</p>
          </div>
        </div>

        {/* 7-day sparkline waterline */}
        {snapshots.length >= 2 && (
          <div className="mt-4 -mx-6 -mb-6 h-16 opacity-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshots.slice(-7).map(s => ({ value: s.netWorthValue ?? s.totalValue }))} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={1.5} fill="url(#sparklineGradient)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* NW Milestones */}
        <div className="mt-5 pt-5 border-t border-b-subtle">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setMilestonesOpen(v => !v)}
              className="flex items-center gap-1.5"
            >
              <Target className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-t-secondary">Milestones</span>
              <ChevronDown className={`w-3.5 h-3.5 text-t-faint transition-transform duration-200 ${milestonesOpen ? '' : '-rotate-90'}`} />
            </button>
            {!addingMilestone && (
              <button
                onClick={() => { setMilestonesOpen(true); setAddingMilestone(true); }}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                <Plus size={13} />
                Add
              </button>
            )}
          </div>

          {milestonesOpen && (
            <>
              {milestones.length > 0 && (
                <div className="space-y-3 mb-3">
                  {milestones.map((m) => {
                    const reached = netWorthSummary.totalNetWorth.amount >= m.value;
                    const pct = m.value > 0 ? (netWorthSummary.totalNetWorth.amount / m.value) * 100 : 0;
                    return (
                      <div key={m.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-t-muted">{m.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold tabular-nums ${reached ? 'text-gain' : 'text-accent'}`}>
                              {pct.toFixed(1)}% of {formatCurrency(m.value)}
                            </span>
                            <button
                              onClick={() => deleteMilestone(m.id)}
                              className="p-0.5 text-t-faint hover:text-loss transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="h-2.5 bg-surface-alt rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: reached
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-t-faint mt-1">
                          {reached ? '✓ Reached!' : `${formatCurrency(m.value - netWorthSummary.totalNetWorth.amount)} to go`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {milestones.length === 0 && !addingMilestone && (
                <p className="text-xs text-t-faint">No milestones set. Add one to track your goals.</p>
              )}

              {addingMilestone && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-32 px-2.5 py-1.5 border border-b-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                  />
                  <span className="text-xs text-t-faint">$</span>
                  <input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
                    placeholder="Amount"
                    min="0"
                    step="1000"
                    className="w-28 px-2.5 py-1.5 border border-b-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                    autoFocus
                  />
                  <button onClick={addMilestone} className="p-1 text-gain hover:opacity-80 transition-opacity"><Check size={14} /></button>
                  <button onClick={() => { setAddingMilestone(false); setNewName(''); setNewValue(''); }} className="p-1 text-t-faint hover:text-t-muted"><X size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Liabilities Section */}
        <LiabilitiesSection showTRY={showTRY} tryRate={tryRate} />
      </div>

      {/* Daily Digest */}
      <DailyDigest />

      {/* Section B: Portfolio Cards */}
      {activeName && (
        <p className="text-xs text-t-muted mb-2">
          Showing <span className="font-medium text-t-secondary">{activeName}</span> portfolio
        </p>
      )}
      {/* P&L Strip */}
      <div className="bg-surface-card card-radius border border-b-default mb-6 overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-b-subtle">
          {/* Portfolio Value */}
          <div className="p-4">
            <span className="text-xs font-medium text-t-muted flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Portfolio Value
            </span>
            <p className="text-2xl font-bold text-t-primary tabular-nums mt-1">{formatCurrency(ps.totalValue)}</p>
          </div>

          {/* Unrealized P&L */}
          <div className="p-4">
            <span className="text-xs font-medium text-t-muted flex items-center gap-1.5">
              {ps.totalGainLoss.amount >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Unrealized
            </span>
            <p className={`text-lg font-bold tabular-nums mt-1 ${ps.totalGainLoss.amount >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(ps.totalGainLoss)}
            </p>
            <p className={`text-[11px] tabular-nums ${ps.totalGainLoss.amount >= 0 ? 'text-gain/60' : 'text-loss/60'}`}>
              {formatPercent(ps.totalGainLossPercent)}
            </p>
          </div>

          {/* Realized P&L */}
          <div className="p-4">
            <span className="text-xs font-medium text-t-muted flex items-center gap-1.5">
              {realizedPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Realized
            </span>
            <p className={`text-lg font-bold tabular-nums mt-1 ${realizedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(realizedPnl)}
            </p>
          </div>

          {/* Total P&L */}
          <div className="p-4">
            <span className="text-xs font-medium text-t-muted flex items-center gap-1.5">
              {totalPnlAmount >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              Total P&L
            </span>
            <p className={`text-lg font-bold tabular-nums mt-1 ${totalPnlAmount >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(totalPnlAmount)}
            </p>
            <p className="text-[10px] text-t-faint tabular-nums">
              Cost basis: {formatCurrency(ps.totalCostBasis)}
            </p>
          </div>

          {/* Today's Change — with tinted background */}
          <div className={`p-4 col-span-2 lg:col-span-1 ${ps.totalDailyChange.amount >= 0 ? 'bg-gain/[0.03]' : 'bg-loss/[0.03]'}`}>
            <span className="text-xs font-medium text-t-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Today
            </span>
            <p className={`text-lg font-bold tabular-nums mt-1 ${ps.totalDailyChange.amount >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(ps.totalDailyChange)}
            </p>
            <p className={`text-[11px] tabular-nums ${ps.totalDailyChange.amount >= 0 ? 'text-gain/60' : 'text-loss/60'}`}>
              {formatPercent(ps.totalDailyChangePercent)}
            </p>
          </div>
        </div>
      </div>

      {/* Section B2: Performance Metrics */}
      <PerformanceMetrics />

      {/* Section C: Net Worth by Category */}
      {netWorthSummary.categoryBreakdown.length > 0 && (
        <div className="bg-surface-card card-radius border border-b-default p-5 mb-6">
          <h3 className="text-sm font-semibold text-t-primary mb-4">Net Worth by Category</h3>
          <div className="space-y-3">
            {netWorthSummary.categoryBreakdown.map((cat, i) => (
              <button
                key={cat.key}
                onClick={() => onNavigate?.('holdings', { category: cat.key })}
                className="block w-full text-left hover:bg-surface-alt/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-t-secondary">{cat.label}</span>
                  <div className="text-sm text-right tabular-nums">
                    <span className="font-medium text-t-primary">{formatCurrency(cat.value)}</span>
                    <span className="text-t-faint ml-2 text-xs">{cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                    style={{ width: `${Math.max(cat.percentage, 0.5)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section D: Top Movers (portfolio only) */}
      {filteredEnrichedHoldings.length > 0 && (
        <div className="bg-surface-card card-radius border border-b-default p-5">
          <h3 className="text-sm font-semibold text-t-primary mb-3">Top Movers Today</h3>
          <div className="flex flex-wrap gap-2">
            {[...filteredEnrichedHoldings]
              .sort((a, b) => Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))
              .filter(h => h.dailyChange.amount !== 0)
              .slice(0, 8)
              .map((h) => (
                <button
                  key={h.id}
                  onClick={() => onNavigate?.('holdings', { ticker: h.ticker })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    h.dailyChangePercent >= 0
                      ? 'bg-gain/[0.08] text-gain hover:bg-gain/[0.15]'
                      : 'bg-loss/[0.08] text-loss hover:bg-loss/[0.15]'
                  }`}
                >
                  <span className="font-bold text-t-primary">{h.ticker}</span>
                  {formatPercent(h.dailyChangePercent)}
                  <span className="text-t-muted font-normal">
                    ({formatSignedCurrency(h.dailyChange)})
                  </span>
                </button>
              ))}
            {filteredEnrichedHoldings.every(h => h.dailyChange.amount === 0) && (
              <p className="text-xs text-t-faint">No movers today</p>
            )}
          </div>
        </div>
      )}
      {showShareModal && (
        <ShareImageModal
          netWorthSummary={netWorthSummary}
          portfolioSummary={filteredPortfolioSummary}
          topHoldings={[...filteredEnrichedHoldings].sort((a, b) => b.marketValue.amount - a.marketValue.amount).slice(0, 5)}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
