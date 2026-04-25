import { Pencil, Trash2, AlertTriangle, Star, GripVertical, FolderInput, Square, CheckSquare } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../utils/formatters';
import { ASSET_TYPE_CONFIG } from '../types';
import type { EnrichedHolding, PriceCache } from '../types';
import { LIVE_METAL_TICKERS } from '../utils/api';

interface HoldingRowProps {
  holding: EnrichedHolding;
  baseCurrency: string;
  categoryLabel?: string;
  showPortfolioBadge?: boolean;
  priceCache: PriceCache;
  isDraggable?: boolean;
  /**
   * 'table' renders a <tr> for use inside a <tbody>. 'card' renders a
   * standalone <div> suitable for a mobile list container. Previously the
   * component rendered BOTH layouts and hid the wrong one with CSS, which
   * produced <tr>-in-<div> hydration warnings on mobile. Now each caller
   * explicitly chooses which layout to render.
   */
  layout: 'table' | 'card';
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onMove?: () => void;
  onTickerClick?: () => void;
  /**
   * Phase 4.3 — bulk-select state. When `selectMode` is true, a
   * checkbox replaces the drag handle in the table layout (and is
   * shown as a leading control on the mobile card layout). Clicking
   * the checkbox calls `onToggleSelect`.
   */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function getStaleWarning(holding: EnrichedHolding, priceCache: PriceCache): string | null {
  if (holding.assetType === 'cash') return null;
  if (holding.skipStaleCheck) return null;

  const key = `${holding.assetType}:${holding.ticker}`;
  const cached = priceCache[key];

  const isLiveMetal = holding.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(holding.ticker);

  if (holding.assetType === 'stock' || holding.assetType === 'etf' || holding.assetType === 'crypto' || isLiveMetal) {
    if (cached && cached.lastUpdated) {
      const hours = (Date.now() - cached.lastUpdated) / (1000 * 60 * 60);
      if (hours > 24) return `Price last updated ${Math.floor(hours / 24)}d ago`;
    } else if (!cached) {
      return 'No price data available';
    }
    return null;
  }

  if (holding.assetType === 'metal' || holding.assetType === 'custom') {
    const lastUpdate = holding.lastManualPriceUpdate;
    if (lastUpdate) {
      const parsed = new Date(lastUpdate).getTime();
      if (!isNaN(parsed)) {
        const days = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
        if (days > 30) return `Manual price last updated ${Math.floor(days)}d ago`;
      }
    } else {
      const parsed = new Date(holding.buyDate).getTime();
      if (!isNaN(parsed)) {
        const days = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
        if (days > 30) return 'Manual price may be outdated';
      }
    }
    return null;
  }

  return null;
}

export function HoldingRow({ holding, baseCurrency, categoryLabel, showPortfolioBadge, priceCache, isDraggable, layout, onEdit, onDelete, onToggleFavorite, onMove, onTickerClick, selectMode, selected, onToggleSelect }: HoldingRowProps) {
  const gainColor = holding.gainLoss.amount >= 0 ? 'text-gain' : 'text-loss';
  const dailyColor = holding.dailyChange.amount >= 0 ? 'text-gain' : 'text-loss';
  const config = ASSET_TYPE_CONFIG[holding.assetType ?? 'stock'];
  const staleWarning = getStaleWarning(holding, priceCache);
  const showNativeCurrency = holding.nativeCurrency !== baseCurrency;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: holding.id, disabled: !isDraggable });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (layout === 'table') {
    return (
      <tr
        ref={setNodeRef}
        style={dragStyle}
        className="hover:bg-surface-alt/50 transition-colors group"
      >
        {selectMode ? (
          <td className="px-2 py-3 w-8">
            <button
              type="button"
              onClick={onToggleSelect}
              className="p-1 text-t-muted hover:text-accent transition-colors"
              aria-label={selected ? `Deselect ${holding.ticker}` : `Select ${holding.ticker}`}
              aria-pressed={selected}
            >
              {selected ? (
                <CheckSquare className="w-4 h-4 text-accent" aria-hidden="true" />
              ) : (
                <Square className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </td>
        ) : isDraggable ? (
          <td className="px-2 py-3 w-8">
            <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1 text-t-faint hover:text-t-muted" aria-label="Drag to reorder">
              <GripVertical className="w-4 h-4" aria-hidden="true" />
            </button>
          </td>
        ) : null}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-semibold text-t-primary ${onTickerClick ? 'cursor-pointer hover:text-accent transition-colors' : ''}`}
                  onClick={onTickerClick}
                >
                  {holding.ticker}
                </span>
                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 badge-radius badge-transform ${config.badgeBg} ${config.badgeColor}`}>
                  {config.label}
                </span>
                {showPortfolioBadge && !holding.inPortfolio && (
                  <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 badge-radius bg-surface-alt text-t-faint">
                    NW only
                  </span>
                )}
              </div>
              <p className="text-xs text-t-muted truncate max-w-[150px]">{holding.name}</p>
              {categoryLabel && (
                <p className="text-[10px] text-t-faint">{categoryLabel}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm text-t-secondary tabular-nums">{holding.shares}</td>
        <td className="px-4 py-3 text-right text-sm text-t-secondary tabular-nums">
          <div>
            {formatCurrency(holding.shares > 0 ? holding.costBasis.amount / holding.shares : holding.buyPrice)}
            {showNativeCurrency && (
              <div className="text-[11px] text-t-faint">
                ({formatCurrency(holding.buyPrice, holding.currency || 'USD')})
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm text-t-secondary tabular-nums">
          <div className="flex items-center justify-end gap-1">
            <div>
              {formatCurrency(holding.currentPrice)}
              {showNativeCurrency && (
                <div className="text-[11px] text-t-faint">
                  ({formatCurrency(holding.nativeCurrentPrice, holding.nativeCurrency)})
                </div>
              )}
            </div>
            {staleWarning && (
              <span title={staleWarning}>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm font-medium text-t-primary tabular-nums">
          {formatCurrency(holding.marketValue)}
        </td>
        <td className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${gainColor}`}>
          <div>{formatSignedCurrency(holding.gainLoss)}</div>
          <div className="text-xs opacity-70">{formatPercent(holding.gainLossPercent)}</div>
        </td>
        <td className="px-4 py-3 text-right text-sm tabular-nums">
          {(() => {
            const isLiveMetal = holding.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(holding.ticker);
            const hasLiveDailyChange = holding.assetType === 'stock' || holding.assetType === 'etf' || holding.assetType === 'crypto';
            // Live metals have no reliable daily change data (API returns 0), so always show dash
            const showDash = (holding.dailyChange.amount === 0 && !hasLiveDailyChange) || isLiveMetal;
            return showDash ? (
              <span className="text-t-faint">&mdash;</span>
            ) : (
              <span className={dailyColor}>{formatSignedCurrency(holding.dailyChange)}</span>
            );
          })()}
        </td>
        <td className="px-4 py-3 text-right text-sm text-t-muted tabular-nums">
          {holding.allocation.toFixed(1)}%
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onToggleFavorite}
              className="p-1.5 hover:bg-surface-alt rounded-lg transition-colors"
              title={holding.isFavorite ? 'Unpin' : 'Pin to top'}
              aria-label={holding.isFavorite ? `Unpin ${holding.ticker}` : `Pin ${holding.ticker} to top`}
              aria-pressed={!!holding.isFavorite}
            >
              <Star className={`w-3.5 h-3.5 ${holding.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-t-faint'}`} aria-hidden="true" />
            </button>
            {onMove && (
              <button
                onClick={onMove}
                className="p-1.5 hover:bg-surface-alt rounded-lg transition-colors"
                title="Move to portfolio"
                aria-label={`Move ${holding.ticker} to another portfolio`}
              >
                <FolderInput className="w-3.5 h-3.5 text-t-faint hover:text-t-muted" aria-hidden="true" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-surface-alt rounded-lg transition-colors"
              title="Edit"
              aria-label={`Edit ${holding.ticker}`}
            >
              <Pencil className="w-3.5 h-3.5 text-t-faint hover:text-t-muted" aria-hidden="true" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-loss-bg rounded-lg transition-colors"
              title="Delete"
              aria-label={`Delete ${holding.ticker}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-t-faint hover:text-loss" aria-hidden="true" />
            </button>
          </div>
          {/* Always-visible favorite star */}
          {holding.isFavorite && (
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 group-hover:hidden ml-auto" aria-hidden="true" />
          )}
        </td>
      </tr>
    );
  }

  // layout === 'card' — standalone <div> for mobile lists (no table wrapper)
  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className="bg-surface-card border border-b-default card-radius p-4 mb-3"
    >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2">
            {selectMode ? (
              <button
                type="button"
                onClick={onToggleSelect}
                className="p-1 text-t-muted hover:text-accent transition-colors mt-0.5"
                aria-label={selected ? `Deselect ${holding.ticker}` : `Select ${holding.ticker}`}
                aria-pressed={selected}
              >
                {selected ? (
                  <CheckSquare className="w-4 h-4 text-accent" aria-hidden="true" />
                ) : (
                  <Square className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            ) : isDraggable ? (
              <button
                {...listeners}
                {...attributes}
                className="cursor-grab active:cursor-grabbing p-1 text-t-faint hover:text-t-muted mt-0.5"
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
            <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-semibold text-t-primary text-base ${onTickerClick ? 'cursor-pointer hover:text-accent transition-colors' : ''}`}
                onClick={onTickerClick}
              >
                {holding.ticker}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 badge-radius badge-transform ${config.badgeBg} ${config.badgeColor}`}>
                {config.label}
              </span>
              {showPortfolioBadge && !holding.inPortfolio && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 badge-radius bg-surface-alt text-t-faint">
                  NW only
                </span>
              )}
            </div>
            <p className="text-xs text-t-muted truncate max-w-[200px]">{holding.name}</p>
            {categoryLabel && (
              <p className="text-[10px] text-t-faint mt-0.5">{categoryLabel}</p>
            )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onToggleFavorite}
              className="p-1.5 hover:bg-surface-alt rounded-lg"
              aria-label={holding.isFavorite ? `Unpin ${holding.ticker}` : `Pin ${holding.ticker} to top`}
              aria-pressed={!!holding.isFavorite}
            >
              <Star className={`w-4 h-4 ${holding.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-t-faint'}`} aria-hidden="true" />
            </button>
            {onMove && (
              <button
                onClick={onMove}
                className="p-1.5 hover:bg-surface-alt rounded-lg"
                title="Move to portfolio"
                aria-label={`Move ${holding.ticker} to another portfolio`}
              >
                <FolderInput className="w-4 h-4 text-t-faint" aria-hidden="true" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-surface-alt rounded-lg"
              aria-label={`Edit ${holding.ticker}`}
            >
              <Pencil className="w-4 h-4 text-t-faint" aria-hidden="true" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-loss-bg rounded-lg"
              aria-label={`Delete ${holding.ticker}`}
            >
              <Trash2 className="w-4 h-4 text-t-faint" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div>
            <span className="text-t-muted text-xs">{config.quantityLabel}</span>
            <p className="font-medium text-t-primary tabular-nums">{holding.shares}</p>
          </div>
          <div className="text-right">
            <span className="text-t-muted text-xs">Price</span>
            <p className="font-medium text-t-primary flex items-center justify-end gap-1 tabular-nums">
              {formatCurrency(holding.currentPrice)}
              {staleWarning && (
                <span title={staleWarning}>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                </span>
              )}
            </p>
            {showNativeCurrency && (
              <p className="text-[11px] text-t-faint tabular-nums">
                ({formatCurrency(holding.nativeCurrentPrice, holding.nativeCurrency)})
              </p>
            )}
          </div>
          <div>
            <span className="text-t-muted text-xs">Market Value</span>
            <p className="font-medium text-t-primary tabular-nums">{formatCurrency(holding.marketValue)}</p>
          </div>
          <div className="text-right">
            <span className="text-t-muted text-xs">Gain/Loss</span>
            <p className={`font-medium tabular-nums ${gainColor}`}>
              {formatSignedCurrency(holding.gainLoss)} ({formatPercent(holding.gainLossPercent)})
            </p>
          </div>
        </div>
    </div>
  );
}
