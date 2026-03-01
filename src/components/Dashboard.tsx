import { useState, useEffect, useCallback } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Clock, Wallet, Target, Plus, Trash2, Check, X, Share2 } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatCurrency, formatSignedCurrency, formatPercent } from '../utils/formatters';
import { EmptyState } from './EmptyState';
import { PerformanceMetrics } from './PerformanceMetrics';
import { DailyDigest } from './DailyDigest';
import { ShareImageModal } from './ShareImageModal';
import { LiabilitiesSection } from './LiabilitiesSection';
import type { NWMilestone } from '../types';

function useTryRate(baseCurrency: string) {
  const [rate, setRate] = useState<number | null>(null);

  const fetchRate = useCallback(async () => {
    if (baseCurrency === 'TRY') { setRate(1); return; }
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}&to=TRY`);
      if (!res.ok) return;
      const data = await res.json();
      setRate(data.rates?.TRY ?? null);
    } catch { /* keep cached */ }
  }, [baseCurrency]);

  useEffect(() => { fetchRate(); }, [fetchRate]);

  return rate;
}

const CATEGORY_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
];

export function Dashboard() {
  const {
    filteredPortfolioSummary,
    filteredEnrichedHoldings,
    netWorthSummary,
    allEnrichedHoldings,
    pricesLoading,
    baseCurrency,
    activePortfolioId,
    portfolios,
    realizedPnl,
  } = usePortfolioContext();

  const [milestones, setMilestones] = useLocalStorage<NWMilestone[]>('nw-milestones', []);
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTRY, setShowTRY] = useState(false);
  const tryRate = useTryRate(baseCurrency);

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
    return <EmptyState onAdd={() => {}} />;
  }

  const activeName = activePortfolioId === 'all'
    ? null
    : portfolios.find((p) => p.id === activePortfolioId)?.name;

  const ps = filteredPortfolioSummary;
  const totalPnl = ps.totalGainLoss + realizedPnl;
  const portfolioCards = [
    {
      title: 'Portfolio Value',
      value: formatCurrency(ps.totalValue),
      icon: DollarSign,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Unrealized P&L',
      value: formatSignedCurrency(ps.totalGainLoss),
      subtitle: formatPercent(ps.totalGainLossPercent),
      icon: ps.totalGainLoss >= 0 ? TrendingUp : TrendingDown,
      color: ps.totalGainLoss >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
      valueColor: ps.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Realized P&L',
      value: formatSignedCurrency(realizedPnl),
      icon: realizedPnl >= 0 ? TrendingUp : TrendingDown,
      color: realizedPnl >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
      valueColor: realizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      title: 'Total P&L',
      value: formatSignedCurrency(totalPnl),
      subtitle: `Cost basis: ${formatCurrency(ps.totalCostBasis)}`,
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
      valueColor: totalPnl >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: "Today's Change",
      value: formatSignedCurrency(ps.totalDailyChange),
      subtitle: formatPercent(ps.totalDailyChangePercent),
      icon: Clock,
      color: ps.totalDailyChange >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
      valueColor: ps.totalDailyChange >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-t-primary">Dashboard</h2>
        <div className="flex items-center gap-2">
          {pricesLoading && (
            <span className="text-xs text-t-muted flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-b-input border-t-accent rounded-full animate-spin" />
              Updating prices...
            </span>
          )}
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 hover:bg-surface-alt rounded-lg transition-colors"
            title="Share as image"
          >
            <Share2 className="w-4 h-4 text-t-muted" />
          </button>
        </div>
      </div>

      {/* Section A: Net Worth Hero */}
      <div className="bg-surface-card rounded-xl border border-b-default p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-t-muted">Total Net Worth</p>
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
            <p className="text-3xl font-bold text-t-primary">
              {showTRY && tryRate
                ? `₺${(netWorthSummary.totalNetWorth * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalNetWorth)}
            </p>
          </div>
        </div>
        {/* Assets / Liabilities breakdown */}
        {netWorthSummary.totalLiabilities > 0 && (
          <div className="flex gap-6 text-sm mb-3">
            <div>
              <span className="text-t-muted">Total Assets</span>
              <p className="font-semibold text-emerald-600">
                {showTRY && tryRate
                  ? `₺${(netWorthSummary.totalAssets * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : formatCurrency(netWorthSummary.totalAssets)}
              </p>
            </div>
            <div>
              <span className="text-t-muted">Liabilities</span>
              <p className="font-semibold text-red-500">
                {showTRY && tryRate
                  ? `-₺${(netWorthSummary.totalLiabilities * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : `-${formatCurrency(netWorthSummary.totalLiabilities)}`}
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-t-muted">Portfolio</span>
            <p className="font-semibold text-t-primary">
              {showTRY && tryRate
                ? `₺${(netWorthSummary.totalPortfolioValue * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalPortfolioValue)}
            </p>
          </div>
          <div>
            <span className="text-t-muted">Other Assets</span>
            <p className="font-semibold text-t-primary">
              {showTRY && tryRate
                ? `₺${(netWorthSummary.totalNonPortfolioValue * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : formatCurrency(netWorthSummary.totalNonPortfolioValue)}
            </p>
          </div>
          <div>
            <span className="text-t-muted">Total Holdings</span>
            <p className="font-semibold text-t-primary">{netWorthSummary.holdingCount}</p>
          </div>
        </div>

        {/* NW Milestones */}
        <div className="mt-4 pt-4 border-t border-b-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-t-secondary">Milestones</span>
            </div>
            {!addingMilestone && (
              <button
                onClick={() => setAddingMilestone(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={13} />
                Add
              </button>
            )}
          </div>

          {milestones.length > 0 && (
            <div className="space-y-2.5 mb-3">
              {milestones.map((m) => {
                const reached = netWorthSummary.totalNetWorth >= m.value;
                const pct = m.value > 0 ? (netWorthSummary.totalNetWorth / m.value) * 100 : 0;
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-t-muted">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${reached ? 'text-emerald-600' : 'text-blue-600'}`}>
                          {pct.toFixed(1)}% of {formatCurrency(m.value)}
                        </span>
                        <button
                          onClick={() => deleteMilestone(m.id)}
                          className="p-0.5 text-t-faint hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-t-faint mt-0.5">
                      {reached ? '✓ Reached!' : `${formatCurrency(m.value - netWorthSummary.totalNetWorth)} to go`}
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
                className="w-32 px-2 py-1 border border-b-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-28 px-2 py-1 border border-b-input rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <button onClick={addMilestone} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
              <button onClick={() => { setAddingMilestone(false); setNewName(''); setNewValue(''); }} className="p-1 text-t-faint hover:text-t-muted"><X size={14} /></button>
            </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {portfolioCards.map((card) => (
          <div
            key={card.title}
            className="bg-surface-card rounded-xl border border-b-default p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-t-muted">{card.title}</span>
            </div>
            <p className={`text-2xl font-bold ${card.valueColor || 'text-t-primary'}`}>
              {card.value}
            </p>
            {card.subtitle && (
              <p className={`text-sm mt-0.5 ${card.valueColor || 'text-t-muted'}`}>
                {card.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Section B2: Performance Metrics */}
      <PerformanceMetrics />

      {/* Section C: Net Worth by Category */}
      {netWorthSummary.categoryBreakdown.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-b-default p-5 mb-4">
          <h3 className="text-sm font-semibold text-t-primary mb-4">Net Worth by Category</h3>
          <div className="space-y-3">
            {netWorthSummary.categoryBreakdown.map((cat, i) => (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-t-secondary">{cat.label}</span>
                  <div className="text-sm text-right">
                    <span className="font-medium text-t-primary">{formatCurrency(cat.value)}</span>
                    <span className="text-t-faint ml-2">{cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                    style={{ width: `${Math.max(cat.percentage, 0.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section D: Top Movers (portfolio only) */}
      {filteredEnrichedHoldings.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-b-default p-5">
          <h3 className="text-sm font-semibold text-t-primary mb-3">Top Movers Today</h3>
          <div className="space-y-2">
            {[...filteredEnrichedHoldings]
              .sort((a, b) => Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))
              .slice(0, 5)
              .map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-t-primary text-sm w-16">{h.ticker}</span>
                    <span className="text-xs text-t-muted truncate max-w-[150px]">{h.name}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium ${
                        h.dailyChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(h.dailyChangePercent)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      {showShareModal && (
        <ShareImageModal
          netWorthSummary={netWorthSummary}
          portfolioSummary={filteredPortfolioSummary}
          topHoldings={[...filteredEnrichedHoldings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5)}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
