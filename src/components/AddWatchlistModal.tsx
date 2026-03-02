import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SymbolSearch } from './SymbolSearch';
import { CryptoSearch } from './CryptoSearch';
import type { AssetType } from '../types';

interface AddWatchlistModalProps {
  apiKey: string;
  onSave: (data: { ticker: string; name: string; assetType: AssetType; coinGeckoId?: string }) => void;
  onClose: () => void;
}

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'crypto', label: 'Crypto' },
];

export function AddWatchlistModal({ apiKey, onSave, onClose }: AddWatchlistModalProps) {
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [coinGeckoId, setCoinGeckoId] = useState('');

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !name.trim()) return;
    onSave({
      ticker: ticker.trim(),
      name: name.trim(),
      assetType,
      ...(coinGeckoId ? { coinGeckoId } : {}),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-enter">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-t-primary">Add to Watchlist</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-alt rounded-lg transition-colors">
            <X className="w-5 h-5 text-t-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset type selector */}
          <div className="flex bg-surface-alt rounded-lg p-0.5">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setAssetType(t.value); setTicker(''); setName(''); setCoinGeckoId(''); }}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  assetType === t.value ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted hover:text-t-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Symbol search */}
          {assetType === 'crypto' ? (
            <CryptoSearch
              onSelect={(id, symbol, cName) => {
                setCoinGeckoId(id);
                setTicker(symbol);
                setName(cName);
              }}
            />
          ) : (
            <SymbolSearch
              apiKey={apiKey}
              assetType={assetType}
              onSelect={(symbol, sName) => {
                setTicker(symbol);
                setName(sName);
              }}
            />
          )}

          {/* Name (auto-filled or editable) */}
          {ticker && (
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!ticker.trim() || !name.trim()}
            className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            Add to Watchlist
          </button>
        </form>
      </div>
    </div>
  );
}
