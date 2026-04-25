import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, ArrowUpDown, RefreshCw, AlertTriangle, GripVertical, Search, CheckSquare, Square, FolderInput, Tag, Trash2, X } from 'lucide-react';
import { formatCurrency, formatSignedCurrency, formatPercent } from '../utils/formatters';
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
import { useSettings } from '../context/SettingsContext';
import { usePricesFx } from '../context/PricesFxContext';
import { useHoldingOrder } from '../hooks/useHoldingOrder';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { HoldingRow } from './HoldingRow';
import { AddEditStockModal } from './AddEditStockModal';
import { CashLedgerModal } from './CashLedgerModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { BulkActionsModal, type BulkActionMode } from './BulkActionsModal';
import { MoveToPortfolioModal } from './MoveToPortfolioModal';
import { EmptyState } from './EmptyState';
import type { Holding, EnrichedHolding, AssetType, TabId } from '../types';
import { ASSET_TYPE_CONFIG } from '../types';
import type { NavFilter } from '../App';

type SortKey = 'ticker' | 'marketValue' | 'gainLoss' | 'gainLossPercent' | 'allocation' | 'dailyChange' | 'custom';
type FilterMode = 'all' | 'portfolio' | 'other';

interface HoldingsTableProps {
  initialFilter?: NavFilter | null;
  onNavigate?: (tab: TabId, filter?: NavFilter) => void;
}

export function HoldingsTable({ initialFilter, onNavigate }: HoldingsTableProps) {
  const {
    allEnrichedHoldings,
    addHolding,
    updateHolding,
    deleteHolding,
    activePortfolioId,
    portfolios,
  } = usePortfolioContext();
  const { apiKey, allCategories, baseCurrency } = useSettings();
  const { pricesLoading, refreshPrices, priceCache } = usePricesFx();

  const { order: holdingOrder, syncOrder, reorder } = useHoldingOrder();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [cashLedgerHolding, setCashLedgerHolding] = useState<Holding | null>(null);
  const [deletingHolding, setDeletingHolding] = useState<Holding | null>(null);
  const [movingHolding, setMovingHolding] = useState<Holding | null>(null);
  // Phase 4.3 — bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkActionMode | null>(null);
  const hasMultiplePortfolios = portfolios.length > 1;
  const [sortKey, setSortKey] = useLocalStorage<SortKey>('holdings-sort-key', 'marketValue');
  const [sortAsc, setSortAsc] = useLocalStorage<boolean>('holdings-sort-asc', false);

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

  // Apply initial filter from cross-page navigation
  useEffect(() => {
    if (initialFilter?.ticker) {
      setSearchQuery(initialFilter.ticker);
    }
    if (initialFilter?.category) {
      setCategoryFilter(initialFilter.category);
    }
  }, [initialFilter]);

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
      list = list.filter((h) => h.portfolioId === activePortfolioId);
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
    const total = filtered.reduce((sum, h) => sum + h.marketValue.amount, 0);
    return filtered.map((h) => ({
      ...h,
      allocation: total > 0 ? (h.marketValue.amount / total) * 100 : 0,
    }));
  }, [filtered]);

  const sorted = useMemo(() => {
    return [...filteredWithAllocation].sort((a, b) => {
      // Favorites float to top — but NOT in custom sort (user controls order fully)
      if (sortKey !== 'custom') {
        const favDiff = (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
        if (favDiff !== 0) return favDiff;
      }
      if (sortKey === 'custom') {
        const ai = holdingOrder.indexOf(a.id);
        const bi = holdingOrder.indexOf(b.id);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      }
      let cmp: number;
      if (sortKey === 'ticker') {
        cmp = a.ticker.localeCompare(b.ticker);
      } else if (sortKey === 'marketValue' || sortKey === 'gainLoss' || sortKey === 'dailyChange') {
        cmp = a[sortKey].amount - b[sortKey].amount;
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
              // buyFxRate is decided inside the modal via decideBuyFxRate
              addHolding(data);
              setShowAddModal(false);
            }}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </>
    );
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleEditHolding(h: Holding) {
    // Cash holdings have a bespoke deposit/withdrawal/interest/correction
    // dialog that also logs a matching transaction. Non-cash holdings
    // use the full AddEditStockModal.
    if (h.assetType === 'cash') {
      setCashLedgerHolding(h);
    } else {
      setEditingHolding(h);
    }
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
      <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? 'text-accent' : 'text-t-faint'}`} />
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
        <h2 className="text-lg font-semibold text-t-primary tracking-tight">Holdings</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isCustomSort) {
                // Capture current visual order before entering reorder mode
                syncOrder(sorted.map((h) => h.id));
                setSortKey('custom');
              } else {
                // Exit reorder mode → fall back to default sort
                setSortKey('marketValue');
                setSortAsc(false);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isCustomSort ? 'bg-accent text-white' : 'text-t-muted hover:bg-surface-alt'
            }`}
            title={isCustomSort ? 'Exit reorder mode' : 'Enable drag-and-drop reorder'}
          >
            <GripVertical className="w-4 h-4" />
            <span className="hidden sm:inline">Reorder</span>
          </button>
          <button
            onClick={refreshPrices}
            disabled={pricesLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-t-muted hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${pricesLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => {
              if (selectMode) exitSelectMode();
              else setSelectMode(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              selectMode ? 'bg-accent text-white' : 'text-t-muted hover:bg-surface-alt'
            }`}
            title={selectMode ? 'Exit select mode' : 'Select multiple holdings for bulk actions'}
            aria-pressed={selectMode}
          >
            {selectMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span className="hidden sm:inline">Select</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Portfolio summary data ribbon */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 mb-4 bg-surface-alt/50 rounded-lg text-xs tabular-nums">
          <span className="text-t-muted">
            <span className="font-semibold text-t-primary">{filtered.length}</span> Holdings
          </span>
          <span className="text-b-subtle">|</span>
          <span className="text-t-muted">
            Total <span className="font-semibold text-t-primary">{formatCurrency(filtered.reduce((s, h) => s + h.marketValue.amount, 0))}</span>
          </span>
          <span className="text-b-subtle">|</span>
          <span className="text-t-muted">
            Gain/Loss <span className={`font-semibold ${filtered.reduce((s, h) => s + h.gainLoss.amount, 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatSignedCurrency(filtered.reduce((s, h) => s + h.gainLoss.amount, 0))}
            </span>
          </span>
          <span className="text-b-subtle">|</span>
          <span className="text-t-muted">
            Return <span className={`font-semibold ${filtered.reduce((s, h) => s + h.gainLoss.amount, 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
              {(() => {
                const totalCost = filtered.reduce((s, h) => s + h.costBasis.amount, 0);
                const totalGain = filtered.reduce((s, h) => s + h.gainLoss.amount, 0);
                return totalCost > 0 ? formatPercent((totalGain / totalCost) * 100) : '0%';
              })()}
            </span>
          </span>
        </div>
      )}

      {/* Bulk actions toolbar (Phase 4.3) */}
      {selectMode && (
        <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 bg-accent/5 border border-accent/30 rounded-lg">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold text-t-primary">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.size === sorted.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(sorted.map((h) => h.id)));
                }
              }}
              className="text-xs text-accent hover:underline"
            >
              {selectedIds.size === sorted.length ? 'Clear all' : 'Select all visible'}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkAction('move')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-t-secondary hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FolderInput className="w-3.5 h-3.5" aria-hidden="true" />
              Move
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkAction('retag')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-t-secondary hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Tag className="w-3.5 h-3.5" aria-hidden="true" />
              Retag
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setBulkAction('delete')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-loss hover:bg-loss-bg rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Delete
            </button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-t-faint hover:bg-surface-alt rounded-lg transition-colors"
              aria-label="Exit select mode"
              title="Exit select mode"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-0.5 mb-4 bg-surface-alt rounded-lg p-1 w-fit">
        {filterButtons.map((btn) => (
          <button
            key={btn.mode}
            onClick={() => setFilterMode(btn.mode)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              filterMode === btn.mode
                ? 'bg-surface-card text-t-primary shadow-sm'
                : 'text-t-muted hover:text-t-primary'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Unified filter bar */}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-t-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by name, ticker, or type..."
            className="w-full pl-9 pr-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1 border border-b-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent bg-transparent"
          >
            <option value="all">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          <div className="flex bg-surface-alt rounded-lg p-0.5">
            <button
              onClick={() => setAssetTypeFilter('all')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                assetTypeFilter === 'all' ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted hover:text-t-secondary'
              }`}
            >All</button>
            {(Object.keys(ASSET_TYPE_CONFIG) as AssetType[]).map((type) => (
              <button
                key={type}
                onClick={() => setAssetTypeFilter(type)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                  assetTypeFilter === type ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted hover:text-t-secondary'
                }`}
              >{ASSET_TYPE_CONFIG[type].label}</button>
            ))}
          </div>
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
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {staleCount} holding{staleCount > 1 ? 's have' : ' has'} outdated prices.
          </div>
        ) : null;
      })()}

      {/* Desktop table */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((h) => h.id)} strategy={verticalListSortingStrategy}>
          <div className="hidden md:block bg-surface-card card-radius border border-b-default overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-t-muted uppercase tracking-wider border-b border-b-default">
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
                    baseCurrency={baseCurrency}
                    categoryLabel={categoryLabelMap[h.category] || h.category}
                    showPortfolioBadge={filterMode === 'all'}
                    priceCache={priceCache}
                    isDraggable={isCustomSort}
                    layout="table"
                    onEdit={() => handleEditHolding(h)}
                    onDelete={() => setDeletingHolding(h)}
                    onToggleFavorite={() => toggleFavorite(h)}
                    onMove={hasMultiplePortfolios ? () => setMovingHolding(h) : undefined}
                    onTickerClick={onNavigate ? () => onNavigate('transactions', { ticker: h.ticker }) : undefined}
                    selectMode={selectMode}
                    selected={selectedIds.has(h.id)}
                    onToggleSelect={() => toggleSelect(h.id)}
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
                baseCurrency={baseCurrency}
                priceCache={priceCache}
                categoryLabel={categoryLabelMap[h.category] || h.category}
                showPortfolioBadge={filterMode === 'all'}
                isDraggable={isCustomSort}
                layout="card"
                onEdit={() => handleEditHolding(h)}
                onDelete={() => setDeletingHolding(h)}
                onToggleFavorite={() => toggleFavorite(h)}
                onMove={hasMultiplePortfolios ? () => setMovingHolding(h) : undefined}
                onTickerClick={onNavigate ? () => onNavigate('transactions', { ticker: h.ticker }) : undefined}
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
          onEditExisting={(existing) => {
            setShowAddModal(false);
            setEditingHolding(existing);
          }}
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

      {cashLedgerHolding && (
        <CashLedgerModal
          holding={cashLedgerHolding}
          onEditDetails={() => setEditingHolding(cashLedgerHolding)}
          onClose={() => setCashLedgerHolding(null)}
        />
      )}

      {bulkAction && (
        <BulkActionsModal
          mode={bulkAction}
          holdingIds={Array.from(selectedIds)}
          onClose={() => setBulkAction(null)}
          onComplete={exitSelectMode}
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
