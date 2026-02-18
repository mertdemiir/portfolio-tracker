import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../utils/formatters';
import { ASSET_TYPE_CONFIG } from '../types';
import type { EnrichedHolding } from '../types';

interface HoldingRowProps {
  holding: EnrichedHolding;
  categoryLabel?: string;
  showPortfolioBadge?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function HoldingRow({ holding, categoryLabel, showPortfolioBadge, onEdit, onDelete }: HoldingRowProps) {
  const gainColor = holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600';
  const dailyColor = holding.dailyChange >= 0 ? 'text-green-600' : 'text-red-600';
  const config = ASSET_TYPE_CONFIG[holding.assetType ?? 'stock'];

  return (
    <>
      {/* Desktop row */}
      <tr className="hidden md:table-row border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-900">{holding.ticker}</span>
                <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${config.badgeBg} ${config.badgeColor}`}>
                  {config.label}
                </span>
                {showPortfolioBadge && !holding.inPortfolio && (
                  <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    NW only
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate max-w-[150px]">{holding.name}</p>
              {categoryLabel && (
                <p className="text-[10px] text-slate-400">{categoryLabel}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-700">{holding.shares}</td>
        <td className="px-4 py-3 text-right text-sm text-slate-700">
          {formatCurrency(holding.buyPrice)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-700">
          {formatCurrency(holding.currentPrice)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-700">
          {formatCurrency(holding.marketValue)}
        </td>
        <td className={`px-4 py-3 text-right text-sm font-medium ${gainColor}`}>
          <div>{formatSignedCurrency(holding.gainLoss)}</div>
          <div className="text-xs">{formatPercent(holding.gainLossPercent)}</div>
        </td>
        <td className={`px-4 py-3 text-right text-sm ${dailyColor}`}>
          {formatSignedCurrency(holding.dailyChange)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-500">
          {holding.allocation.toFixed(1)}%
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-500" />
            </button>
          </div>
        </td>
      </tr>

      {/* Mobile card */}
      <div className="md:hidden bg-white border border-slate-200 rounded-xl p-4 mb-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-base">{holding.ticker}</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.badgeBg} ${config.badgeColor}`}>
                {config.label}
              </span>
              {showPortfolioBadge && !holding.inPortfolio && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  NW only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{holding.name}</p>
            {categoryLabel && (
              <p className="text-[10px] text-slate-400 mt-0.5">{categoryLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <Pencil className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">{config.quantityLabel}</span>
            <p className="font-medium text-slate-800">{holding.shares}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Price</span>
            <p className="font-medium text-slate-800">{formatCurrency(holding.currentPrice)}</p>
          </div>
          <div>
            <span className="text-slate-500">Market Value</span>
            <p className="font-medium text-slate-800">{formatCurrency(holding.marketValue)}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500">Gain/Loss</span>
            <p className={`font-medium ${gainColor}`}>
              {formatSignedCurrency(holding.gainLoss)} ({formatPercent(holding.gainLossPercent)})
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
