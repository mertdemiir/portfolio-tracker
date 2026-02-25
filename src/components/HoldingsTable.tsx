import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, ArrowUpDown, RefreshCw, AlertTriangle, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useHoldingOrder } from '../hooks/useHoldingOrder';
import { HoldingRow } from './HoldingRow';
import { AddEditStockModal } from './AddEditStockModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { MoveToPortfolioModal } from './MoveToPortfolioModal';
import { EmptyState } from './EmptyState';
import type { Holding, EnrichedHolding, AssetType } from '../types';
import { ASSET_TYPE_CONFIG, DEFAULT_PORTFOLIO_ID } from '../types';

type SortKey = 'ticker' | 'marketValue' | 'gainLoss' | 'gainLossPercent' | 'allocation' | 'dailyChange' | 'custom';
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
    priceCache,
    activePortfolioId,
    portfolios,
  } = usePortfolioContext();

  const { order: holdingOrder, syncOrder, reorder } = useHoldingOrder();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [movingHolding, setMovingHolding] = useState<Holding | null>(null);
  const hasMultiplePortfolios = portfolios.length > 1;
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [sortAsc, setSortAsc] = useState(false);

  // Keep holding order in sync with actual holdings
  useEffect(() => {
    if (allEnrichedHoldings.length > 0) {
      syncOrder(allEnrichedHoldings.map((h) => h.id));
    }
  }, [allEnrichedHoldings, syncOrder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('all');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = useMemo(() => {
    let list = allEnrichedHoldings;
    // Filter by active portfolio
    if (activePortfolioId !== 'all') {
      list = list.filter((h) => (h.portfolioId || DEFAULT_PORTFOLIO_ID) === activePortfolioId);
    }
    if (filterMode === 'portfolio') list = list.filter((h) => h.inPortfolio);
    if (filterMode === 'other') list = list.filter((h) => !h.inPortfolio);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (h) => h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((h) => h.category === categoryFilter);
    }
    if (assetTypeFilter !== 'all') {
      list = list.filter((h) => h.assetType === assetTypeFilter);
    }
    return list;
  }, [allEnrichedHoldings, activePortfolioId, filterMode, searchQuery, categoryFilter, assetTypeFilter]);

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
      // Favorites always float to top
      const favDiff = (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
      if (favDiff !== 0) return favDiff;
      if (sortKey === 'custom') {
        const ai = holdingOrder.indexOf(a.id);
        const bi = holdingOrder.indexOf(b.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      }
      let cmp: number;
      if (sortKey === 'ticker') {
        cmp = a.ticker.localeCompare(b.ticker);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredWithAllocation, sortKey, sortAsc, holdingOrder]);

  function toggleFavorite(holding: EnrichedHolding) {
    const { currentPrice: _, marketValue: _mv, costBasis: _cb, gainLoss: _gl, gainLossPercent: _glp, dailyChange: _dc, dailyChangePercent: _dcp, allocation: _al, ...base } = holding;
    updateHolding(holding.id, { ...base, isFavorite: !holding.isFavorite });
  }

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorder(active.id as string, over.id as string);
    }
  }

  const isCustomSort = sortKey === 'custom';

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 hover:text-t-primary transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? 'text-blue-600' : 'text-t-faint'}`} />
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
        <h2 className="text-lg font-semibold text-t-primary">Holdings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortKey((k) => k === 'custom' ? 'marketValue' : 'custom')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
              isCustomSort ? 'bg-accent text-white' : 'text-t-muted hover:bg-surface-alt'
            }`}
            title={isCustomSort ? 'Exit custom order' : 'Enable drag-and-drop reorder'}
          >
            <GripVertical className="w-4 h-4" />
            <span className="hidden sm:inline">Reorder</span>
          </button>
          <button
            onClick={refreshPrices}
            disabled={pricesLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-t-muted hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${pricesLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-surface-alt rounded-lg p-1 w-fit">
        {filterButtons.map((btn) => (
          <button
            key={btn.mode}
            onClick={() => setFilterMode(btn.mode)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filterMode === btn.mode
                ? 'bg-surface-card text-t-primary shadow-sm'
                : 'text-t-muted hover:text-t-primary'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ticker or name..."
          className="px-3 py-1.5 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          {allCategories.map((cat) => (
            <option key={cat.key} value={cat.key}>{cat.label}</option>
          ))}
        </select>
        <div className="flex bg-surface-alt rounded-lg p-0.5">
          <button
            onClick={() => setAssetTypeFilter('all')}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              assetTypeFilter === 'all' ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted hover:text-t-secondary'
            }`}
          >All Types</button>
          {(Object.keys(ASSET_TYPE_CONFIG) as AssetType[]).map((type) => (
            <button
              key={type}
              onClick={() => setAssetTypeFilter(type)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                assetTypeFilter === type ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted hover:text-t-secondary'
              }`}
            >{ASSET_TYPE_CONFIG[type].label}</button>
          ))}
        </div>
      </div>

      {/* Stale price warning banner */}
      {(() => {
        const staleCount = sorted.filter((h) => {
          if (h.assetType === 'cash') return false;
          const key = `${h.assetType}:${h.ticker}`;
          const cached = priceCache[key];
          if (h.assetType === 'stock' || h.assetType === 'etf' || h.assetType === 'crypto') {
            return !cached || (Date.now() - cached.lastUpdated) > 24 * 60 * 60 * 1000;
          }
          const lastUpdate = h.lastManualPriceUpdate;
          if (!lastUpdate) {
            return (Date.now() - new Date(h.buyDate).getTime()) > 30 * 24 * 60 * 60 * 1000;
          }
          return (Date.now() - new Date(lastUpdate).getTime()) > 30 * 24 * 60 * 60 * 1000;
        }).length;
        return staleCount > 0 ? (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {staleCount} holding{staleCount > 1 ? 's have' : ' has'} outdated prices.
          </div>
        ) : null;
      })()}

      {/* Desktop table */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((h) => h.id)} strategy={verticalListSortingStrategy}>
          <div className="hidden md:block bg-surface-card rounded-xl border border-b-default overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface text-xs font-medium text-t-muted uppercase tracking-wider">
                  {isCustomSort && <th className="px-2 py-3 w-8" />}
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
                    priceCache={priceCache}
                    isDraggable={isCustomSort}
                    onEdit={() => setEditingHolding(h)}
                    onDelete={() => setDeletingHolding(h)}
                    onToggleFavorite={() => toggleFavorite(h)}
                    onMove={hasMultiplePortfolios ? () => setMovingHolding(h) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>

      {/* Mobile cards */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((h) => h.id)} strategy={verticalListSortingStrategy}>
          <div className="md:hidden">
            {sorted.map((h: EnrichedHolding) => (
              <HoldingRow
                key={h.id}
                holding={h}
                priceCache={priceCache}
                categoryLabel={categoryLabelMap[h.category] || h.category}
                showPortfolioBadge={filterMode === 'all'}
                isDraggable={isCustomSort}
                onEdit={() => setEditingHolding(h)}
                onDelete={() => setDeletingHolding(h)}
                onToggleFavorite={() => toggleFavorite(h)}
                onMove={hasMultiplePortfolios ? () => setMovingHolding(h) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

      {movingHolding && (
        <MoveToPortfolioModal
          holding={movingHolding}
          onClose={() => setMovingHolding(null)}
        />
      )}
    </div>
  );
}
