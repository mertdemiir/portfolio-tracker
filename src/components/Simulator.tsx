import { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RotateCcw, Plus, Trash2, Zap, AlertTriangle, Scale, TrendingUp } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { getChartColors, getChartPalette } from '../hooks/useTheme';
import { formatCurrency, formatSignedCurrency, formatPercent } from '../utils/formatters';

interface SimHolding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  currentPrice: number;
  simPrice: number;
  simShares: number;
  costBasis: number;
  isHypothetical: boolean;
}

type SimMode = 'simulate' | 'rebalance';
type TargetMode = 'pct' | 'dollar';
interface RebalTarget { mode: TargetMode; value: string; }

interface RebalRow {
  id: string;
  ticker: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  targetValue: number;
  action: number; // positive = buy, negative = sell
  isAuto: boolean;
  isLocked: boolean;
}

// PIE_COLORS is now theme-aware — computed inside the component

const SHOCK_PRESETS = [
  { label: '-30%', factor: 0.7 },
  { label: '-20%', factor: 0.8 },
  { label: '-10%', factor: 0.9 },
  { label: '+10%', factor: 1.1 },
  { label: '+20%', factor: 1.2 },
  { label: '+50%', factor: 1.5 },
];

export function Simulator() {
  const { filteredEnrichedHoldings } = usePortfolioContext();
  const { theme } = useSettings();
  const cc = getChartColors(theme);
  const PIE_COLORS = getChartPalette(theme);

  const initialHoldings: SimHolding[] = useMemo(() =>
    filteredEnrichedHoldings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      shares: h.shares,
      // SimHolding is an internal number-based type; the simulator does
      // heavy arithmetic on these values and doesn't round-trip back to
      // persisted storage. Unwrap Money here to a plain base-currency
      // number.
      currentPrice: h.currentPrice.amount,
      simPrice: h.currentPrice.amount,
      simShares: h.shares,
      costBasis: h.costBasis.amount,
      isHypothetical: false,
    })),
    [filteredEnrichedHoldings],
  );

  const [holdings, setHoldings] = useState<SimHolding[]>(initialHoldings);
  const [mode, setMode] = useState<SimMode>('simulate');
  const [rebalTargets, setRebalTargets] = useState<Record<string, RebalTarget>>({});

  // Sync prices from live data when they refresh
  useEffect(() => {
    setHoldings((prev) => {
      const newMap = new Map(initialHoldings.map((h) => [h.id, h]));
      const updated = prev
        .map((h) => {
          if (h.isHypothetical) return h;
          const fresh = newMap.get(h.id);
          if (fresh) {
            return { ...h, currentPrice: fresh.currentPrice, costBasis: fresh.costBasis };
          }
          return null; // holding was removed
        })
        .filter((h): h is SimHolding => h !== null);
      // Add any new holdings from initialHoldings not already in prev
      for (const ih of initialHoldings) {
        if (!updated.some((h) => h.id === ih.id)) {
          updated.push(ih);
        }
      }
      return updated;
    });
  }, [initialHoldings]);

  // Clear rebalance targets when portfolio changes
  useEffect(() => {
    setRebalTargets({});
  }, [filteredEnrichedHoldings]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newShares, setNewShares] = useState('');

  const currentTotalValue = filteredEnrichedHoldings.reduce((sum, h) => sum + h.marketValue.amount, 0);

  const simTotalValue = holdings.reduce((sum, h) => sum + h.simPrice * h.simShares, 0);
  const simTotalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const simPL = simTotalValue - simTotalCost;
  const simPLPct = simTotalCost > 0 ? (simPL / simTotalCost) * 100 : 0;
  const valueDiff = simTotalValue - currentTotalValue;

  // --- Rebalance computation ---
  const rebalRows: RebalRow[] = useMemo(() => {
    // Only real holdings participate in rebalance
    const realHoldings = holdings.filter((h) => !h.isHypothetical);
    const totalValue = realHoldings.reduce((sum, h) => sum + h.currentPrice * h.shares, 0);
    if (totalValue <= 0) return [];

    // Classify each holding
    const classified = realHoldings.map((h) => {
      const target = rebalTargets[h.id];
      const currentValue = h.currentPrice * h.shares;
      const currentPct = (currentValue / totalValue) * 100;
      const val = target?.value ? parseFloat(target.value) : NaN;

      let kind: 'manual' | 'locked' | 'auto' = 'auto';
      if (target && target.value.trim() !== '') {
        if (!isNaN(val)) {
          kind = target.mode === 'dollar' ? 'locked' : 'manual';
        }
      }
      return { holding: h, currentValue, currentPct, kind, inputVal: isNaN(val) ? 0 : val };
    });

    const lockedTotal = classified
      .filter((c) => c.kind === 'locked')
      .reduce((sum, c) => sum + c.inputVal, 0);
    const manualPctTotal = classified
      .filter((c) => c.kind === 'manual')
      .reduce((sum, c) => sum + c.inputVal, 0);

    const redistributable = Math.max(0, totalValue - lockedTotal);
    const remainingPct = Math.max(0, 100 - manualPctTotal);

    // Auto-fill: proportional to current weights among auto group
    const autoGroup = classified.filter((c) => c.kind === 'auto');
    const autoTotalCurrent = autoGroup.reduce((sum, c) => sum + c.currentValue, 0);

    return classified.map((c) => {
      let targetPct: number;
      let targetValue: number;
      let isAuto = false;
      let isLocked = false;

      if (c.kind === 'locked') {
        targetValue = c.inputVal;
        targetPct = totalValue > 0 ? (targetValue / totalValue) * 100 : 0;
        isLocked = true;
      } else if (c.kind === 'manual') {
        targetPct = c.inputVal;
        targetValue = (targetPct / 100) * redistributable;
      } else {
        // auto
        isAuto = true;
        if (autoTotalCurrent > 0) {
          const proportion = c.currentValue / autoTotalCurrent;
          targetPct = remainingPct * proportion;
        } else {
          targetPct = autoGroup.length > 0 ? remainingPct / autoGroup.length : 0;
        }
        targetValue = (targetPct / 100) * redistributable;
      }

      return {
        id: c.holding.id,
        ticker: c.holding.ticker,
        currentValue: c.currentValue,
        currentPct: c.currentPct,
        targetPct,
        targetValue,
        action: targetValue - c.currentValue,
        isAuto,
        isLocked,
      };
    });
  }, [holdings, rebalTargets]);

  const rebalWarnings: string[] = useMemo(() => {
    const warns: string[] = [];
    const realHoldings = holdings.filter((h) => !h.isHypothetical);
    const totalValue = realHoldings.reduce((sum, h) => sum + h.currentPrice * h.shares, 0);

    const manualPctTotal = Object.entries(rebalTargets)
      .filter(([, t]) => t.mode === 'pct' && t.value.trim() !== '' && !isNaN(parseFloat(t.value)))
      .reduce((sum, [, t]) => sum + parseFloat(t.value), 0);
    const lockedTotal = Object.entries(rebalTargets)
      .filter(([, t]) => t.mode === 'dollar' && t.value.trim() !== '' && !isNaN(parseFloat(t.value)))
      .reduce((sum, [, t]) => sum + parseFloat(t.value), 0);

    if (manualPctTotal > 100) warns.push(`Target weights sum to ${manualPctTotal.toFixed(1)}% (exceeds 100%)`);
    if (lockedTotal > totalValue) warns.push(`Locked amounts ($${lockedTotal.toFixed(0)}) exceed portfolio value ($${totalValue.toFixed(0)})`);
    return warns;
  }, [holdings, rebalTargets]);

  // Rebalance pie data
  const rebalPieData = useMemo(() =>
    rebalRows
      .filter((r) => r.targetValue > 0)
      .map((r) => ({ name: r.ticker, value: parseFloat(r.targetValue.toFixed(2)) }))
      .sort((a, b) => b.value - a.value),
    [rebalRows],
  );

  const totalTurnover = useMemo(() =>
    rebalRows.reduce((sum, r) => sum + Math.abs(r.action), 0) / 2,
    [rebalRows],
  );
  const adjustmentCount = useMemo(() =>
    rebalRows.filter((r) => Math.abs(r.action) >= 0.01).length,
    [rebalRows],
  );

  function updateHolding(id: string, field: 'simPrice' | 'simShares', value: number) {
    setHoldings((prev) => prev.map((h) => h.id === id ? { ...h, [field]: value } : h));
  }

  function deleteHolding(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  function applyShock(factor: number) {
    setHoldings((prev) => prev.map((h) => ({ ...h, simPrice: parseFloat((h.simPrice * factor).toFixed(2)) })));
  }

  function resetAll() {
    setHoldings(initialHoldings);
    setRebalTargets({});
  }

  function updateRebalTarget(id: string, field: 'mode' | 'value', val: string) {
    setRebalTargets((prev) => {
      const existing = prev[id] ?? { mode: 'pct' as TargetMode, value: '' };
      return { ...prev, [id]: { ...existing, [field]: val } };
    });
  }

  function addHypothetical() {
    const price = parseFloat(newPrice);
    const shares = parseFloat(newShares);
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker || isNaN(price) || isNaN(shares) || price <= 0 || shares <= 0) return;

    const newHolding: SimHolding = {
      id: crypto.randomUUID(),
      ticker,
      name: newName.trim() || ticker,
      shares: 0,
      currentPrice: price,
      simPrice: price,
      simShares: shares,
      costBasis: price * shares,
      isHypothetical: true,
    };

    setHoldings((prev) => [...prev, newHolding]);
    setNewTicker('');
    setNewName('');
    setNewPrice('');
    setNewShares('');
    setShowAddForm(false);
  }

  // Pie chart data (simulate mode)
  const pieData = holdings
    .filter((h) => h.simPrice * h.simShares > 0)
    .map((h) => ({
      name: h.ticker,
      value: parseFloat((h.simPrice * h.simShares).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  const activePieData = mode === 'rebalance' ? rebalPieData : pieData;
  const activePieTotal = mode === 'rebalance'
    ? rebalRows.reduce((sum, r) => sum + r.targetValue, 0)
    : simTotalValue;

  if (filteredEnrichedHoldings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-t-muted">
        <p>Add holdings first to use the simulator.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="m-page-head">
        <div>
          <div className="m-h1">
            {mode === 'simulate' ? 'What-If Simulator' : 'Portfolio Rebalancer'}
          </div>
          <div className="m-sub">
            {mode === 'simulate'
              ? 'Stress-test prices and scenarios against your portfolio.'
              : 'Plan trades to bring your allocation back to target.'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
          <div className="mv2-sort-pills">
            <button
              onClick={() => setMode('simulate')}
              className={mode === 'simulate' ? 'active' : ''}
            >
              <TrendingUp size={13} aria-hidden="true" className="inline mr-1" />
              Simulate
            </button>
            <button
              onClick={() => setMode('rebalance')}
              className={mode === 'rebalance' ? 'active' : ''}
            >
              <Scale size={13} aria-hidden="true" className="inline mr-1" />
              Rebalance
            </button>
          </div>
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-t-muted hover:text-t-secondary bg-surface-alt rounded-lg hover:bg-surface-active transition-colors"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-surface-card card-radius border border-b-default border-l-4 border-l-amber-500 p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-t-secondary">
            {mode === 'simulate'
              ? 'This is a simulation tool. No changes are saved to your actual portfolio.'
              : 'Plan your rebalance. No trades are executed — use the actions as a guide.'}
          </p>
        </div>
      </div>

      {/* Rebalance Warnings */}
      {mode === 'rebalance' && rebalWarnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 card-radius p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              {rebalWarnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-600 dark:text-amber-400">{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {mode === 'simulate' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-card card-radius border border-b-default p-5 hover:shadow-sm transition-all duration-200">
            <p className="text-sm text-t-muted mb-1">Simulated Value</p>
            <p className="text-2xl font-bold text-t-primary tabular-nums">{formatCurrency(simTotalValue)}</p>
            <p className={`text-sm mt-1 font-medium tabular-nums ${valueDiff >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(valueDiff)} from current
            </p>
          </div>
          <div className={`bg-surface-card card-radius border border-b-default border-l-4 ${simPL >= 0 ? 'border-l-gain' : 'border-l-loss'} p-5 hover:shadow-sm transition-all duration-200`}>
            <p className="text-sm text-t-muted mb-1">Simulated P&L</p>
            <p className={`text-2xl font-bold tabular-nums ${simPL >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(simPL)}
            </p>
            <p className={`text-sm mt-1 tabular-nums ${simPL >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatPercent(simPLPct)}
            </p>
          </div>
          <div className="bg-surface-card card-radius border border-b-default p-5 hover:shadow-sm transition-all duration-200">
            <p className="text-sm text-t-muted mb-1">Holdings</p>
            <p className="text-2xl font-bold text-t-primary tabular-nums">{holdings.length}</p>
            <p className="text-sm text-t-faint mt-1 tabular-nums">
              Cost basis: {formatCurrency(simTotalCost)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-card card-radius border border-b-default p-5 hover:shadow-sm transition-all duration-200">
            <p className="text-sm text-t-muted mb-1">Portfolio Value</p>
            <p className="text-2xl font-bold text-t-primary tabular-nums">{formatCurrency(currentTotalValue)}</p>
            <p className="text-sm text-t-faint mt-1">Unchanged after rebalance</p>
          </div>
          <div className="bg-surface-card card-radius border border-b-default p-5 hover:shadow-sm transition-all duration-200">
            <p className="text-sm text-t-muted mb-1">Total Trades</p>
            <p className="text-2xl font-bold text-t-primary tabular-nums">{formatCurrency(totalTurnover)}</p>
            <p className="text-sm text-t-faint mt-1">Capital to move</p>
          </div>
          <div className="bg-surface-card card-radius border border-b-default p-5 hover:shadow-sm transition-all duration-200">
            <p className="text-sm text-t-muted mb-1">Adjustments</p>
            <p className="text-2xl font-bold text-t-primary tabular-nums">{adjustmentCount}</p>
            <p className="text-sm text-t-faint mt-1">Holdings to buy/sell</p>
          </div>
        </div>
      )}

      {/* Price Shock Buttons — simulate only */}
      {mode === 'simulate' && (
        <div className="bg-surface-card card-radius card-shadow p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-t-secondary">Price Shock</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SHOCK_PRESETS.map((s) => (
              <button
                key={s.label}
                onClick={() => applyShock(s.factor)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  s.factor < 1
                    ? 'bg-loss/10 text-loss hover:bg-loss/20'
                    : 'bg-gain/10 text-gain hover:bg-gain/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table / Rebalance Table */}
        <div className="lg:col-span-2 bg-surface-card card-radius border border-b-default overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h3 className="text-sm font-semibold text-t-primary">
              {mode === 'simulate' ? 'Holdings' : 'Rebalance Plan'}
            </h3>
            {mode === 'simulate' && (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover font-medium"
              >
                <Plus size={13} />
                Add Hypothetical
              </button>
            )}
          </div>

          {mode === 'simulate' && showAddForm && (
            <div className="flex flex-wrap items-center gap-2 mx-5 mb-3 p-3 bg-surface rounded-lg">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="Ticker"
                className="w-20 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (opt)"
                className="w-24 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Price"
                min="0"
                step="0.01"
                className="w-20 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent tabular-nums"
              />
              <input
                type="number"
                value={newShares}
                onChange={(e) => setNewShares(e.target.value)}
                placeholder="Shares"
                min="0"
                step="1"
                className="w-20 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent tabular-nums"
              />
              <button onClick={addHypothetical} className="px-2 py-1 bg-accent text-white rounded-md text-xs font-medium hover:bg-accent-hover">Add</button>
              <button onClick={() => setShowAddForm(false)} className="px-2 py-1 text-t-muted text-xs hover:text-t-secondary">Cancel</button>
            </div>
          )}

          <div className="overflow-x-auto px-5 pb-5">
            {mode === 'simulate' ? (
              /* ---- SIMULATE TABLE ---- */
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-b-default text-left">
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Ticker</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Current</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Sim Price</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Shares</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Sim Value</th>
                    <th className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Change</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const simValue = h.simPrice * h.simShares;
                    const origValue = h.currentPrice * h.shares;
                    const change = simValue - origValue;
                    const changePct = origValue > 0 ? (change / origValue) * 100 : 0;
                    return (
                      <tr key={h.id} className="border-b border-b-subtle hover:bg-surface-alt/50 transition-colors">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-t-primary">{h.ticker}</span>
                            {h.isHypothetical && (
                              <span className="text-[10px] px-1 py-0.5 bg-accent-light text-accent rounded">NEW</span>
                            )}
                          </div>
                          <span className="text-[10px] text-t-faint truncate block max-w-[100px]">{h.name}</span>
                        </td>
                        <td className="py-2 pr-3 text-t-muted tabular-nums">
                          {h.isHypothetical ? '-' : formatCurrency(h.currentPrice)}
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={h.simPrice}
                            onChange={(e) => updateHolding(h.id, 'simPrice', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-20 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent tabular-nums"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={h.simShares}
                            onChange={(e) => updateHolding(h.id, 'simShares', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
                            className="w-16 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent tabular-nums"
                          />
                        </td>
                        <td className="py-2 pr-3 text-right font-medium text-t-primary tabular-nums">
                          {formatCurrency(simValue)}
                        </td>
                        <td className={`py-2 text-right font-medium tabular-nums ${change >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {h.isHypothetical ? '-' : `${change >= 0 ? '+' : ''}${changePct.toFixed(1)}%`}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => deleteHolding(h.id)}
                            className="p-0.5 text-t-faint hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* ---- REBALANCE TABLE ---- */
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-b-default text-left">
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Ticker</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Current</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Now %</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Target</th>
                    <th className="pb-2 pr-3 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Target $</th>
                    <th className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rebalRows.map((r) => {
                    const target = rebalTargets[r.id];
                    const targetMode = target?.mode ?? 'pct';
                    const targetValue = target?.value ?? '';
                    return (
                      <tr key={r.id} className="border-b border-b-subtle hover:bg-surface-alt/50 transition-colors">
                        <td className="py-2 pr-3">
                          <span className="font-medium text-t-primary">{r.ticker}</span>
                        </td>
                        <td className="py-2 pr-3 text-right text-t-muted tabular-nums">
                          {formatCurrency(r.currentValue)}
                        </td>
                        <td className="py-2 pr-3 text-right text-t-muted tabular-nums">
                          {r.currentPct.toFixed(1)}%
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={targetValue}
                              onChange={(e) => updateRebalTarget(r.id, 'value', e.target.value)}
                              placeholder={r.isAuto ? r.targetPct.toFixed(1) : ''}
                              min="0"
                              step={targetMode === 'pct' ? '0.1' : '1'}
                              className="w-20 bg-input-bg border border-b-input rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent tabular-nums"
                            />
                            <button
                              onClick={() => updateRebalTarget(r.id, 'mode', targetMode === 'pct' ? 'dollar' : 'pct')}
                              className={`px-1.5 py-1 text-[10px] font-bold rounded transition-colors ${
                                targetMode === 'dollar'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                  : 'bg-surface-alt text-t-muted hover:text-t-secondary'
                              }`}
                              title={targetMode === 'pct' ? 'Switch to dollar amount' : 'Switch to percentage'}
                            >
                              {targetMode === 'pct' ? '%' : '$'}
                            </button>
                          </div>
                          {r.isAuto && (
                            <span className="text-[10px] text-t-faint mt-0.5 block">auto</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-t-secondary">
                          {formatCurrency(r.targetValue)}
                        </td>
                        <td className={`py-2 text-right font-medium tabular-nums ${
                          Math.abs(r.action) < 0.01 ? 'text-t-faint' : r.action >= 0 ? 'text-gain' : 'text-loss'
                        }`}>
                          {Math.abs(r.action) < 0.01
                            ? '—'
                            : r.action > 0
                              ? `Buy ${formatCurrency(r.action)}`
                              : `Sell ${formatCurrency(Math.abs(r.action))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-b-default">
                    <td className="py-2 pr-3 font-semibold text-t-primary">Total</td>
                    <td className="py-2 pr-3 text-right font-semibold text-t-primary tabular-nums">
                      {formatCurrency(currentTotalValue)}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-t-muted tabular-nums">100%</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold tabular-nums ${
                        Math.abs(rebalRows.reduce((s, r) => s + r.targetPct, 0) - 100) > 0.1
                          ? 'text-amber-500'
                          : 'text-t-muted'
                      }`}>
                        {rebalRows.reduce((s, r) => s + r.targetPct, 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-t-primary tabular-nums">
                      {formatCurrency(rebalRows.reduce((s, r) => s + r.targetValue, 0))}
                    </td>
                    <td className="py-2 text-right font-semibold text-t-muted tabular-nums">
                      {formatCurrency(totalTurnover)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Allocation Pie */}
        <div className="bg-surface-card card-radius card-shadow p-5">
          <h3 className="text-sm font-semibold text-t-primary mb-3">
            {mode === 'simulate' ? 'Simulated Allocation' : 'Target Allocation'}
          </h3>
          {activePieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={activePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    stroke="none"
                  >
                    {activePieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                    contentStyle={{ borderRadius: '8px', border: `1px solid ${cc.tooltipBorder}`, fontSize: '12px', backgroundColor: cc.tooltipBg, color: cc.tooltipText }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2 max-h-[200px] overflow-y-auto">
                {activePieData.map((d, i) => {
                  const pct = activePieTotal > 0 ? (d.value / activePieTotal) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-t-secondary">{d.name}</span>
                      </div>
                      <span className="text-xs text-t-muted tabular-nums">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[240px] text-xs text-t-faint">
              No holdings with value
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
