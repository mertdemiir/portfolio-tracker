import { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Check, X, Share2, ChevronDown } from 'lucide-react';
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
import { WhatChangedTodayCard } from './WhatChangedTodayCard';
import { PortfolioComparisonWidget } from './PortfolioComparisonWidget';
import { ShareImageModal } from './ShareImageModal';
import { LiabilitiesSection } from './LiabilitiesSection';
import { HeroCard } from './HeroCard';
import { KpiBand } from './KpiBand';
import type { NWMilestone, TabId } from '../types';
import type { NavFilter } from '../App';

interface DashboardProps {
  onNavigate?: (tab: TabId, filter?: NavFilter) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const {
    filteredPortfolioSummary,
    filteredEnrichedHoldings,
    netWorthSummary,
    allEnrichedHoldings,
    activePortfolioId,
    portfolios,
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
  // Total P&L (unrealized + realized, both in base currency) — used by
  // PerformanceMetrics + KpiBand below.
  void ps; // ps is referenced indirectly through filteredPortfolioSummary in subcomponents

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

      {/* Mercury HeroCard (M2) */}
      <HeroCard
        tryToggle={
          baseCurrency !== 'TRY' && tryRate
            ? { active: showTRY, rate: tryRate, onToggle: () => setShowTRY((p) => !p) }
            : undefined
        }
      />

      {/* Mercury KpiBand (M3) */}
      <KpiBand />

      {/* Milestones card */}
      <div className="bg-surface-card rounded-2xl border border-b-default p-5 mb-6 mt-4">
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
                              ? 'linear-gradient(90deg, var(--gain), var(--gain))'
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
                <button
                  onClick={addMilestone}
                  className="p-1 text-gain hover:opacity-80 transition-opacity"
                  aria-label="Add milestone"
                  title="Add milestone"
                >
                  <Check size={14} aria-hidden="true" />
                </button>
                <button
                  onClick={() => { setAddingMilestone(false); setNewName(''); setNewValue(''); }}
                  className="p-1 text-t-faint hover:text-t-muted"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Liabilities Section */}
      <LiabilitiesSection showTRY={showTRY} tryRate={tryRate} />

      {/* Daily Digest */}
      <DailyDigest />

      {/* What changed today (Phase 4.4) */}
      <WhatChangedTodayCard onNavigate={onNavigate} />

      {/* Portfolio comparison across periods (Phase 4.2) */}
      <PortfolioComparisonWidget />

      {/* Section B: Portfolio Cards */}
      {activeName && (
        <p className="text-xs text-t-muted mb-2">
          Showing <span className="font-medium text-t-secondary">{activeName}</span> portfolio
        </p>
      )}
      {/* Section B (legacy P&L Strip) replaced by HeroCard's bottom strip
          + KpiBand (M3). Realized / Total P&L now live in KpiBand. */}

      {/* Section B2: Performance Metrics */}
      <PerformanceMetrics />

      {/* Section C: Net Worth by Category — Mercury m-cat-row layout (M3) */}
      {netWorthSummary.categoryBreakdown.length > 0 && (
        <div className="mv2-card mv2-card-pad mb-6">
          <div className="mv2-panel-head">
            <div>
              <div className="mv2-card-title">Net Worth by Category</div>
              <div className="mv2-card-subtitle">Distribution across all categories</div>
            </div>
          </div>
          <div>
            {netWorthSummary.categoryBreakdown.map((cat, i) => {
              const palette = ['#3b5bdb', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#ef4444', '#f97316'];
              const fill = palette[i % palette.length];
              return (
                <button
                  key={cat.key}
                  onClick={() => onNavigate?.('holdings', { category: cat.key })}
                  className="m-cat-row w-full text-left hover:bg-surface-alt/40 transition-colors -mx-2 px-2 rounded-md"
                  style={{ marginInline: 0 }}
                >
                  <div className="m-cat-label">{cat.label}</div>
                  <div className="m-cat-bar">
                    <div
                      className="m-cat-bar-fill"
                      style={{ width: `${Math.max(cat.percentage, 0.5)}%`, background: fill }}
                    />
                  </div>
                  <div className="m-cat-val">
                    {formatCurrency(cat.value)}
                    <span className="m-cat-pct">{cat.percentage.toFixed(1)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Section D: Top Movers — Mercury 3-column m-mover-row grid (M3) */}
      {filteredEnrichedHoldings.length > 0 && (
        <div className="mv2-card mv2-card-pad mb-6">
          <div className="m-row" style={{ marginBottom: 12 }}>
            <div className="mv2-card-title">Top movers today</div>
            <span className="mv2-card-subtitle">Sorted by % change</span>
          </div>
          {(() => {
            const movers = [...filteredEnrichedHoldings]
              .filter((h) => h.dailyChange.amount !== 0)
              .sort((a, b) => Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))
              .slice(0, 6);
            if (movers.length === 0) {
              return <p className="text-xs text-t-faint">No movers today</p>;
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
                {movers.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => onNavigate?.('holdings', { ticker: h.ticker })}
                    className="m-mover-row w-full text-left hover:bg-surface-alt/40 transition-colors px-2 -mx-2 rounded-md"
                  >
                    <div>
                      <div className="m-tkr">{h.ticker}</div>
                      <div className="m-tkr-name">{h.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        className={'tabular ' + (h.dailyChangePercent >= 0 ? 'pct-up' : 'pct-down')}
                        style={{ fontWeight: 600, fontSize: 13 }}
                      >
                        {formatPercent(h.dailyChangePercent)}
                      </div>
                      <div className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatSignedCurrency(h.dailyChange)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
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
