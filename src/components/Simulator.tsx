import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RotateCcw, Plus, Trash2, Zap, AlertTriangle } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
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

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
];

const SHOCK_PRESETS = [
  { label: '-30%', factor: 0.7 },
  { label: '-20%', factor: 0.8 },
  { label: '-10%', factor: 0.9 },
  { label: '+10%', factor: 1.1 },
  { label: '+20%', factor: 1.2 },
  { label: '+50%', factor: 1.5 },
];

export function Simulator() {
  const { allEnrichedHoldings, theme } = usePortfolioContext();
  const cc = getChartColors(theme);

  const initialHoldings: SimHolding[] = useMemo(() =>
    allEnrichedHoldings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      shares: h.shares,
      currentPrice: h.currentPrice,
      simPrice: h.currentPrice,
      simShares: h.shares,
      costBasis: h.costBasis,
      isHypothetical: false,
    })),
    [allEnrichedHoldings],
  );

  const [holdings, setHoldings] = useState<SimHolding[]>(initialHoldings);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newShares, setNewShares] = useState('');

  const currentTotalValue = allEnrichedHoldings.reduce((sum, h) => sum + h.marketValue, 0);

  const simTotalValue = holdings.reduce((sum, h) => sum + h.simPrice * h.simShares, 0);
  const simTotalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const simPL = simTotalValue - simTotalCost;
  const simPLPct = simTotalCost > 0 ? (simPL / simTotalCost) * 100 : 0;
  const valueDiff = simTotalValue - currentTotalValue;

  function updateHolding(id: string, field: 'simPrice' | 'simShares', value: number) {
    setHoldings((prev) => prev.map((h) => h.id === id ? { ...h, [field]: value } : h));
  }

  function deleteHolding(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  function applyShock(factor: number) {
    setHoldings((prev) => prev.map((h) => ({ ...h, simPrice: parseFloat((h.currentPrice * factor).toFixed(2)) })));
  }

  function resetAll() {
    setHoldings(initialHoldings);
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

  // Pie chart data
  const pieData = holdings
    .filter((h) => h.simPrice * h.simShares > 0)
    .map((h) => ({
      name: h.ticker,
      value: parseFloat((h.simPrice * h.simShares).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);

  if (allEnrichedHoldings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-t-muted">
        <p>Add holdings first to use the simulator.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-t-primary">What-If Simulator</h2>
        <button
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-t-muted bg-surface-alt rounded-lg hover:bg-surface-active transition-colors"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          This is a simulation tool. No changes are saved to your actual portfolio.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-surface-card rounded-xl border border-b-default p-5">
          <p className="text-sm text-t-muted mb-1">Simulated Value</p>
          <p className="text-2xl font-bold text-t-primary">{formatCurrency(simTotalValue)}</p>
          <p className={`text-sm mt-1 font-medium ${valueDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatSignedCurrency(valueDiff)} from current
          </p>
        </div>
        <div className="bg-surface-card rounded-xl border border-b-default p-5">
          <p className="text-sm text-t-muted mb-1">Simulated P&L</p>
          <p className={`text-2xl font-bold ${simPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatSignedCurrency(simPL)}
          </p>
          <p className={`text-sm mt-1 ${simPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercent(simPLPct)}
          </p>
        </div>
        <div className="bg-surface-card rounded-xl border border-b-default p-5">
          <p className="text-sm text-t-muted mb-1">Holdings</p>
          <p className="text-2xl font-bold text-t-primary">{holdings.length}</p>
          <p className="text-sm text-t-faint mt-1">
            Cost basis: {formatCurrency(simTotalCost)}
          </p>
        </div>
      </div>

      {/* Price Shock Buttons */}
      <div className="bg-surface-card rounded-xl border border-b-default p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-t-secondary">Price Shock</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SHOCK_PRESETS.map((s) => (
            <button
              key={s.label}
              onClick={() => applyShock(s.factor)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                s.factor < 1
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Holdings Table */}
        <div className="lg:col-span-2 bg-surface-card rounded-xl border border-b-default p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-t-primary">Holdings</h3>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={13} />
              Add Hypothetical
            </button>
          </div>

          {showAddForm && (
            <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-surface rounded-lg">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="Ticker"
                className="w-20 px-2 py-1 border border-b-input rounded-md text-xs"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (opt)"
                className="w-24 px-2 py-1 border border-b-input rounded-md text-xs"
              />
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Price"
                min="0"
                step="0.01"
                className="w-20 px-2 py-1 border border-b-input rounded-md text-xs"
              />
              <input
                type="number"
                value={newShares}
                onChange={(e) => setNewShares(e.target.value)}
                placeholder="Shares"
                min="0"
                step="1"
                className="w-20 px-2 py-1 border border-b-input rounded-md text-xs"
              />
              <button onClick={addHypothetical} className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700">Add</button>
              <button onClick={() => setShowAddForm(false)} className="px-2 py-1 text-t-muted text-xs hover:text-t-secondary">Cancel</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-b-default text-left">
                  <th className="pb-2 pr-3 font-medium text-t-muted">Ticker</th>
                  <th className="pb-2 pr-3 font-medium text-t-muted">Current</th>
                  <th className="pb-2 pr-3 font-medium text-t-muted">Sim Price</th>
                  <th className="pb-2 pr-3 font-medium text-t-muted">Shares</th>
                  <th className="pb-2 pr-3 font-medium text-t-muted text-right">Sim Value</th>
                  <th className="pb-2 font-medium text-t-muted text-right">Change</th>
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
                    <tr key={h.id} className="border-b border-b-subtle hover:bg-surface">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-t-primary">{h.ticker}</span>
                          {h.isHypothetical && (
                            <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded">NEW</span>
                          )}
                        </div>
                        <span className="text-[10px] text-t-faint truncate block max-w-[100px]">{h.name}</span>
                      </td>
                      <td className="py-2 pr-3 text-t-muted">
                        {h.isHypothetical ? '-' : formatCurrency(h.currentPrice)}
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={h.simPrice}
                          onChange={(e) => updateHolding(h.id, 'simPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-20 px-1.5 py-0.5 border border-b-default rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          value={h.simShares}
                          onChange={(e) => updateHolding(h.id, 'simShares', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="1"
                          className="w-16 px-1.5 py-0.5 border border-b-default rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-t-primary">
                        {formatCurrency(simValue)}
                      </td>
                      <td className={`py-2 text-right font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          </div>
        </div>

        {/* Allocation Pie */}
        <div className="bg-surface-card rounded-xl border border-b-default p-4">
          <h3 className="text-sm font-semibold text-t-primary mb-3">Simulated Allocation</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
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
                {pieData.map((d, i) => {
                  const pct = simTotalValue > 0 ? (d.value / simTotalValue) * 100 : 0;
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-t-secondary">{d.name}</span>
                      </div>
                      <span className="text-xs text-t-muted">{pct.toFixed(1)}%</span>
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
