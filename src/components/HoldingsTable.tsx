import { useState, useMemo } from 'react';
import { PlusCircle, ArrowUpDown, RefreshCw } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { HoldingRow } from './HoldingRow';
import { AddEditStockModal } from './AddEditStockModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EmptyState } from './EmptyState';
import type { Holding, EnrichedHolding } from '../types';

type SortKey = 'ticker' | 'marketValue' | 'gainLoss' | 'gainLossPercent' | 'allocation' | 'dailyChange';
type FilterMode = 'all' | 'portfolio' | 'other';

export function HoldingsTable() {
  const {
    apiKey,
    allEnrichedHoldings,
    addHolding,
    updateHolding,
    deleteHolding,
    pricesLoading,
    refreshPrices,
    allCategories,
  } = usePortfolioContext();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = useMemo(() => {
    if (filterMode === 'portfolio') return allEnrichedHoldings.filter((h) => h.inPortfolio);
    if (filterMode === 'other') return allEnrichedHoldings.filter((h) => !h.inPortfolio);
    return allEnrichedHoldings;
  }, [allEnrichedHoldings, filterMode]);

  // Recompute allocation % for filtered set
  const filteredWithAllocation = useMemo(() => {
    const total = filtered.reduce((sum, h) => sum + h.marketValue, 0);
    return filtered.map((h) => ({
      ...h,
      allocation: total > 0 ? (h.marketValue / total) * 100 : 0,
    }));
  }, [filtered]);

  const sorted = useMemo(() => {
    return [...filteredWithAllocation].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'ticker') {
        cmp = a.ticker.localeCompare(b.ticker);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredWithAllocation, sortKey, sortAsc]);

  // Build category label map
  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of allCategories) map[cat.key] = cat.label;
    return map;
  }, [allCategories]);

  if (allEnrichedHoldings.length === 0) {
    return (
      <>
        <EmptyState onAdd={() => setShowAddModal(true)} />
        {showAddModal && (
          <AddEditStockModal
            apiKey={apiKey}
            onSave={(data) => {
              addHolding(data);
              setShowAddModal(false);
            }}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </>
    );
  }

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? 'text-blue-600' : 'text-slate-400'}`} />
    </button>
  );

  const filterButtons: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: 'All' },
    { mode: 'portfolio', label: 'Portfolio' },
    { mode: 'other', label: 'Other Assets' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Holdings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshPrices}
            disabled={pricesLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${pricesLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {filterButtons.map((btn) => (
          <button
            key={btn.mode}
            onClick={() => setFilterMode(btn.mode)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterMode === btn.mode
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left"><SortButton label="Symbol" field="ticker" /></th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right"><SortButton label="Value" field="marketValue" /></th>
              <th className="px-4 py-3 text-right"><SortButton label="Gain/Loss" field="gainLoss" /></th>
              <th className="px-4 py-3 text-right"><SortButton label="Today" field="dailyChange" /></th>
              <th className="px-4 py-3 text-right"><SortButton label="Weight" field="allocation" /></th>
              <th className="px-4 py-3 text-right w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h: EnrichedHolding) => (
              <HoldingRow
                key={h.id}
                holding={h}
                categoryLabel={categoryLabelMap[h.category] || h.category}
                showPortfolioBadge={filterMode === 'all'}
                onEdit={() => setEditingHolding(h)}
                onDelete={() => setDeletingHolding(h)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {sorted.map((h: EnrichedHolding) => (
          <HoldingRow
            key={h.id}
            holding={h}
            categoryLabel={categoryLabelMap[h.category] || h.category}
            showPortfolioBadge={filterMode === 'all'}
            onEdit={() => setEditingHolding(h)}
            onDelete={() => setDeletingHolding(h)}
          />
        ))}
      </div>

      {showAddModal && (
        <AddEditStockModal
          apiKey={apiKey}
          onSave={(data) => {
            addHolding(data);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {editingHolding && (
        <AddEditStockModal
          apiKey={apiKey}
          holding={editingHolding}
          onSave={(data) => {
            updateHolding(editingHolding.id, data);
            setEditingHolding(null);
          }}
          onClose={() => setEditingHolding(null)}
        />
      )}

      {deletingHolding && (
        <DeleteConfirmModal
          ticker={deletingHolding.ticker}
          onConfirm={() => {
            deleteHolding(deletingHolding.id);
            setDeletingHolding(null);
          }}
          onClose={() => setDeletingHolding(null)}
        />
      )}
    </div>
  );
}
