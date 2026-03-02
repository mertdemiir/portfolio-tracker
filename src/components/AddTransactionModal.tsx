import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { todayDateString } from '../utils/formatters';
import { DEFAULT_PORTFOLIO_ID } from '../types';

interface AddTransactionModalProps {
  onClose: () => void;
}

export function AddTransactionModal({ onClose }: AddTransactionModalProps) {
  const { holdings, addTransaction, updateHolding, deleteHolding, activePortfolioId } = usePortfolioContext();
  const [date, setDate] = useState(todayDateString());
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([]);
  const [sellError, setSellError] = useState('');

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  function handleTickerChange(value: string) {
    setTicker(value);
    if (value.length > 0) {
      const unique = new Map<string, string>();
      for (const h of holdings) {
        if (h.ticker.toLowerCase().includes(value.toLowerCase()) || h.name.toLowerCase().includes(value.toLowerCase())) {
          unique.set(h.ticker, h.name);
        }
      }
      setSuggestions(Array.from(unique.entries()).map(([ticker, name]) => ({ ticker, name })).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }

  function selectSuggestion(s: { ticker: string; name: string }) {
    setTicker(s.ticker);
    setName(s.name);
    setSuggestions([]);
  }

  const total = (parseFloat(shares) || 0) * (parseFloat(pricePerShare) || 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSellError('');
    const s = parseFloat(shares);
    const p = parseFloat(pricePerShare);
    if (!date || !ticker.trim() || isNaN(s) || s <= 0 || isNaN(p) || p <= 0) return;

    const tickerNorm = ticker.trim().toUpperCase();
    // Find matching holding — prefer active portfolio, then any
    const allMatches = holdings.filter((h) => h.ticker.toUpperCase() === tickerNorm);
    const match = allMatches.find((h) => (h.portfolioId || DEFAULT_PORTFOLIO_ID) === activePortfolioId)
      || allMatches[0]
      || null;

    // Sell validation: must have a matching holding with enough shares
    if (type === 'sell') {
      if (!match) {
        setSellError(`No holding found for ${tickerNorm}. Cannot sell what you don't own.`);
        return;
      }
      if (s > match.shares) {
        setSellError(`You only own ${match.shares} shares of ${tickerNorm}. Cannot sell ${s}.`);
        return;
      }
    }

    addTransaction({
      date,
      ticker: tickerNorm,
      name: name.trim() || tickerNorm,
      type,
      shares: s,
      pricePerShare: p,
      total: s * p,
      ...(notes.trim() && { notes: notes.trim() }),
      ...(type === 'sell' && match ? {
        costBasisPerShare: match.buyPrice,
        assetType: match.assetType,
        category: match.category,
        currency: match.currency,
        portfolioId: match.portfolioId,
      } : {}),
    });
    if (match) {
      const { id, ...data } = match;
      if (type === 'sell') {
        const remaining = match.shares - s;
        if (remaining <= 0) {
          deleteHolding(id);
        } else {
          updateHolding(id, { ...data, shares: remaining });
        }
      } else {
        // Buy: increase shares and recalculate weighted average cost basis
        const oldCost = match.shares * match.buyPrice;
        const newCost = s * p;
        const newShares = match.shares + s;
        const avgPrice = (oldCost + newCost) / newShares;
        // Preserve original buyDate on DCA — don't overwrite with today's date
        updateHolding(id, { ...data, shares: newShares, buyPrice: avgPrice });
      }
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-modal-enter">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-t-primary">Log Transaction</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-alt rounded-lg transition-colors">
            <X className="w-5 h-5 text-t-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="flex bg-surface-alt rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setType('buy')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === 'buy' ? 'bg-surface-card text-gain shadow-sm' : 'text-t-muted'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setType('sell')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === 'sell' ? 'bg-surface-card text-loss shadow-sm' : 'text-t-muted'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              max={todayDateString()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              required
            />
          </div>

          {/* Ticker with autocomplete */}
          <div className="relative">
            <label className="block text-xs font-medium text-t-muted mb-1">Ticker / Symbol</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => handleTickerChange(e.target.value)}
              placeholder="e.g. AAPL, BTC"
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              required
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-surface-card border border-b-default rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.ticker}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-surface flex items-center gap-2"
                  >
                    <span className="font-medium text-t-primary">{s.ticker}</span>
                    <span className="text-t-muted text-xs truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-filled or enter manually"
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
          </div>

          {/* Shares + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Shares / Units</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Price per Share ($)</label>
              <input
                type="number"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                required
              />
            </div>
          </div>

          {/* Total */}
          {total > 0 && (
            <div className="bg-surface rounded-lg px-3 py-2 text-sm">
              <span className="text-t-muted">Total: </span>
              <span className="font-semibold text-t-primary">
                ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. DCA purchase, rebalancing"
              rows={2}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
            />
          </div>

          {/* Sell error */}
          {sellError && (
            <p className="text-sm text-loss bg-loss-bg rounded-lg px-3 py-2">{sellError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Log Transaction
          </button>
        </form>
      </div>
    </div>
  );
}
