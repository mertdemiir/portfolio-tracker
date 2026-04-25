import { useState, useCallback, useEffect } from 'react';
import { PlusCircle, Trash2, RefreshCw, ArrowUpDown } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';
import { useSettings } from '../context/SettingsContext';
import { usePricesFx } from '../context/PricesFxContext';
import { AddWatchlistModal } from './AddWatchlistModal';
import { formatCurrency, formatSignedCurrency, formatPercent, formatDate } from '../utils/formatters';
import { ASSET_TYPE_CONFIG } from '../types';
import type { Holding } from '../types';

type SortKey = 'ticker' | 'price' | 'change' | 'changePercent' | 'addedDate';

export function Watchlist() {
  const { apiKey } = useSettings();
  const { items, addItem, deleteItem } = useWatchlist();
  // Share the unified price cache with the portfolio. If both portfolio
  // and watchlist contain AAPL, we fetch it once and display the same
  // price everywhere. Portfolio's 5-min interval covers the refresh; we
  // expose a manual refresh button for the watchlist.
  const { priceCache, fetchPrices } = usePricesFx();
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('addedDate');
  const [sortAsc, setSortAsc] = useState(false);

  const refresh = useCallback(async () => {
    if (items.length === 0) return;
    setLoading(true);
    // Translate watchlist items into Holding shape so fetchPrices can
    // consume them. Zero-share "fake holdings" work because fetchPrices
    // only reads ticker + assetType + coinGeckoId for dispatch.
    const fakeHoldings: Holding[] = items.map((item) => ({
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
    }));
    await fetchPrices(fakeHoldings, true);
    setLoading(false);
  }, [items, fetchPrices]);

  // Fetch any items missing from the unified cache on mount. Items already
  // covered by the portfolio's fetch loop (same ticker + assetType) are
  // automatically deduped by the adapter's staleness check.
  useEffect(() => {
    const missing = items.filter((it) => !priceCache[`${it.assetType}:${it.ticker}`]);
    if (missing.length === 0) return;
    if (missing.some((it) => (it.assetType === 'stock' || it.assetType === 'etf') && !apiKey)) {
      // Some items need the API key but we don't have it — let the rest fetch.
    }
    const fakeHoldings: Holding[] = missing.map((item) => ({
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
    }));
    fetchPrices(fakeHoldings);
  }, [items, priceCache, fetchPrices, apiKey]);

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
      <div className="m-page-head">
        <div>
          <div className="m-h1">Watchlist</div>
          {items.length > 0 && (
            <div className="m-sub">{items.length} symbol{items.length === 1 ? '' : 's'} tracked</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-t-muted hover:bg-surface-alt rounded-lg transition-colors disabled:opacity-50"
            title="Refresh prices"
            aria-label="Refresh prices"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-surface-emph text-t-on-emph rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
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
          {/* Desktop table — Mercury m-table */}
          <div className="hidden md:block">
            <table className="m-table">
              <thead>
                <tr>
                  <th><SortButton label="Symbol" field="ticker" /></th>
                  <th>Name</th>
                  <th className="num"><SortButton label="Price" field="price" /></th>
                  <th className="num"><SortButton label="Change" field="change" /></th>
                  <th className="num"><SortButton label="Change %" field="changePercent" /></th>
                  <th className="num"><SortButton label="Added" field="addedDate" /></th>
                  <th style={{ width: 64, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const changeColor = item.change >= 0 ? 'text-gain' : 'text-loss';
                  const config = ASSET_TYPE_CONFIG[item.assetType ?? 'stock'];
                  return (
                    <tr key={item.id} className="group">
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.ticker}</span>
                          <span className={`m-badge ${config.badgeBg} ${config.badgeColor}`} style={{ borderColor: 'transparent' }}>
                            {config.label}
                          </span>
                        </div>
                      </td>
                      <td className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>{item.name}</td>
                      <td className="num">
                        {item.price > 0 ? formatCurrency(item.price) : '—'}
                      </td>
                      <td className={`num ${changeColor}`}>
                        {item.price > 0 ? formatSignedCurrency(item.change) : '—'}
                      </td>
                      <td className={`num font-medium ${changeColor}`}>
                        {item.price > 0 ? formatPercent(item.changePercent) : '—'}
                      </td>
                      <td className="num" style={{ color: 'var(--text-faint)' }}>
                        {formatDate(item.addedDate)}
                      </td>
                      <td className="text-right">
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
