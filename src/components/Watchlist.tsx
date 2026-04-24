import { useState, useEffect, useCallback, useRef } from 'react';
import { PlusCircle, Trash2, RefreshCw, ArrowUpDown } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useSettings } from '../context/SettingsContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { AddWatchlistModal } from './AddWatchlistModal';
import { fetchPriceForHolding, delay } from '../utils/api';
import { formatCurrency, formatSignedCurrency, formatPercent, formatDate } from '../utils/formatters';
import { ASSET_TYPE_CONFIG } from '../types';
import type { PriceCache, Holding } from '../types';

type SortKey = 'ticker' | 'price' | 'change' | 'changePercent' | 'addedDate';

export function Watchlist() {
  const { apiKey } = useSettings();
  const { items, addItem, deleteItem } = useWatchlist();
  const [priceCache, setPriceCache] = useLocalStorage<PriceCache>('watchlist-price-cache', {});
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('addedDate');
  const [sortAsc, setSortAsc] = useState(false);
  const abortRef = useRef(false);

  const fetchPrices = useCallback(async () => {
    if (items.length === 0) return;
    setLoading(true);
    abortRef.current = false;

    for (const item of items) {
      if (abortRef.current) break;
      // Skip stock/etf if no API key
      if ((item.assetType === 'stock' || item.assetType === 'etf') && !apiKey) continue;

      try {
        const fakeHolding: Holding = {
          id: item.id,
          ticker: item.ticker,
          name: item.name,
          shares: 0,
          buyPrice: 0,
          buyDate: item.addedDate,
          assetType: item.assetType,
          coinGeckoId: item.coinGeckoId,
          inPortfolio: false,
          category: 'other',
          portfolioId: 'default',
        };
        const key = `${item.assetType}:${item.ticker}`;
        const quote = await fetchPriceForHolding(fakeHolding, apiKey);
        setPriceCache((prev) => ({ ...prev, [key]: quote }));
      } catch {
        // skip individual errors
      }
      await delay(200);
    }
    setLoading(false);
  }, [items, apiKey, setPriceCache]);

  // Fetch on mount and every 5 min
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(() => {
      if (!document.hidden) fetchPrices();
    }, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      abortRef.current = true;
    };
  }, [fetchPrices]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const enriched = items.map((item) => {
    const key = `${item.assetType}:${item.ticker}`;
    const cached = priceCache[key];
    return {
      ...item,
      price: cached?.currentPrice ?? 0,
      change: cached?.change ?? 0,
      changePercent: cached?.changePercent ?? 0,
    };
  });

  const sorted = [...enriched].sort((a, b) => {
    let cmp: number;
    switch (sortKey) {
      case 'ticker': cmp = a.ticker.localeCompare(b.ticker); break;
      case 'price': cmp = a.price - b.price; break;
      case 'change': cmp = a.change - b.change; break;
      case 'changePercent': cmp = a.changePercent - b.changePercent; break;
      case 'addedDate': cmp = a.addedDate.localeCompare(b.addedDate); break;
      default: cmp = 0;
    }
    return sortAsc ? cmp : -cmp;
  });

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 hover:text-t-primary transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? 'text-accent' : 'text-t-faint'}`} />
    </button>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-t-primary tracking-tight">Watchlist</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-t-muted hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Symbol
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-t-muted mb-2">Your watchlist is empty.</p>
          <p className="text-sm text-t-faint mb-4">Track stocks, ETFs, and crypto you're interested in.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add your first symbol
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface-card card-radius border border-b-default overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-t-muted uppercase tracking-wider border-b border-b-default">
                  <th className="px-4 py-3 text-left"><SortButton label="Symbol" field="ticker" /></th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-right"><SortButton label="Price" field="price" /></th>
                  <th className="px-4 py-3 text-right"><SortButton label="Change" field="change" /></th>
                  <th className="px-4 py-3 text-right"><SortButton label="Change %" field="changePercent" /></th>
                  <th className="px-4 py-3 text-right"><SortButton label="Added" field="addedDate" /></th>
                  <th className="px-4 py-3 text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const changeColor = item.change >= 0 ? 'text-gain' : 'text-loss';
                  const config = ASSET_TYPE_CONFIG[item.assetType ?? 'stock'];
                  return (
                    <tr key={item.id} className="border-b border-b-subtle hover:bg-surface-alt/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-t-primary">{item.ticker}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config.badgeBg} ${config.badgeColor}`}>
                            {config.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-t-muted truncate max-w-[200px]">{item.name}</td>
                      <td className="px-4 py-3 text-right text-sm text-t-secondary tabular-nums">
                        {item.price > 0 ? formatCurrency(item.price) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm tabular-nums ${changeColor}`}>
                        {item.price > 0 ? formatSignedCurrency(item.change) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${changeColor}`}>
                        {item.price > 0 ? formatPercent(item.changePercent) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-t-faint tabular-nums">
                        {formatDate(item.addedDate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 hover:bg-loss-bg rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove from watchlist"
                          aria-label={`Remove ${item.ticker} from watchlist`}
                        >
                          <Trash2 className="w-4 h-4 text-t-muted hover:text-loss" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            {sorted.map((item) => {
              const changeColor = item.change >= 0 ? 'text-gain' : 'text-loss';
              const config = ASSET_TYPE_CONFIG[item.assetType ?? 'stock'];
              return (
                <div key={item.id} className="bg-surface-card card-radius border border-b-default p-4 mb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-t-primary text-base">{item.ticker}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${config.badgeBg} ${config.badgeColor}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-t-muted truncate max-w-[200px]">{item.name}</p>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1.5 hover:bg-loss-bg rounded-lg transition-colors"
                      aria-label={`Remove ${item.ticker} from watchlist`}
                    >
                      <Trash2 className="w-4 h-4 text-t-muted" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-sm">
                    <div>
                      <span className="text-t-muted">Price</span>
                      <p className="font-medium text-t-primary tabular-nums">
                        {item.price > 0 ? formatCurrency(item.price) : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-t-muted">Change</span>
                      <p className={`font-medium tabular-nums ${changeColor}`}>
                        {item.price > 0 ? `${formatSignedCurrency(item.change)} (${formatPercent(item.changePercent)})` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showAddModal && (
        <AddWatchlistModal
          apiKey={apiKey}
          onSave={addItem}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
