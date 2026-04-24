import { useState } from 'react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useFxRates } from '../hooks/useFxRates';
import { todayDateString, formatCurrency } from '../utils/formatters';
import { DEFAULT_PORTFOLIO_ID } from '../types';

interface AddTransactionModalProps {
  onClose: () => void;
}

export function AddTransactionModal({ onClose }: AddTransactionModalProps) {
  const { holdings, addTransaction, updateHolding, deleteHolding, activePortfolioId, baseCurrency } = usePortfolioContext();
  const { convertToBase, fxRates } = useFxRates(baseCurrency);
  const [date, setDate] = useState(todayDateString());
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [shares, setShares] = useState('');
  const [pricePerShare, setPricePerShare] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState<{ ticker: string; name: string }[]>([]);
  const [submitError, setSubmitError] = useState('');

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
    setSubmitError('');
    const s = parseFloat(shares);
    const p = parseFloat(pricePerShare);
    if (!date || !ticker.trim() || isNaN(s) || s <= 0 || isNaN(p) || p <= 0) return;

    const tickerNorm = ticker.trim().toUpperCase();
    // Find matching holding — scoped to active portfolio (Bug 1: don't cross-pollinate portfolios)
    const allMatches = holdings.filter((h) => h.ticker.toUpperCase() === tickerNorm);
    const match = activePortfolioId === 'all'
      ? allMatches[0] || null
      : allMatches.find((h) => h.portfolioId === activePortfolioId) || null;

    // Sell validation: must have a matching holding with enough shares
    if (type === 'sell') {
      if (!match) {
        setSubmitError(`No holding found for ${tickerNorm}. Cannot sell what you don't own.`);
        return;
      }
      if (s > match.shares) {
        setSubmitError(`You only own ${match.shares} shares of ${tickerNorm}. Cannot sell ${s}.`);
        return;
      }
    }

    // Transactions are required to have a portfolioId (schema v1). If
    // the user is in the "all" scope and there's no matched holding, we
    // attribute the transaction to the default portfolio so the data
    // shape stays valid.
    const txnPortfolioId = match?.portfolioId
      ?? (activePortfolioId !== 'all' ? activePortfolioId : DEFAULT_PORTFOLIO_ID);

    addTransaction({
      date,
      ticker: tickerNorm,
      name: name.trim() || tickerNorm,
      type,
      shares: s,
      pricePerShare: p,
      total: s * p,
      portfolioId: txnPortfolioId,
      ...(notes.trim() && { notes: notes.trim() }),
      ...(type === 'sell' && match ? {
        costBasisPerShare: match.buyPrice,
        assetType: match.assetType,
        category: match.category,
        currency: match.currency,
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
        // Buy (DCA into existing holding): increase shares and recalculate
        // weighted average cost basis + buyFxRate.
        const holdingCurrency = match.currency || 'USD';
        const needsFx = holdingCurrency !== baseCurrency;
        const fxReady = !needsFx || (fxRates && fxRates.base === baseCurrency);

        // If this is a foreign-currency DCA and rates are not loaded, refuse
        // to write anything — otherwise we'd update buyPrice but leave
        // buyFxRate stale, silently drifting the cost basis.
        if (!fxReady) {
          setSubmitError(
            `Waiting for live exchange rates for ${holdingCurrency}. ` +
            `Try again in a moment, or check your internet connection.`
          );
          return;
        }

        const oldCost = match.shares * match.buyPrice;
        const newCost = s * p;
        const newShares = match.shares + s;
        const avgPrice = (oldCost + newCost) / newShares;
        const updatedData: typeof data & { buyFxRate?: number } = { ...data, shares: newShares, buyPrice: avgPrice };

        if (needsFx && fxRates && fxRates.base === baseCurrency) {
          const currentFxRate = convertToBase(1, holdingCurrency);
          const oldFxRate = match.buyFxRate ?? currentFxRate; // fallback for pre-existing holdings
          updatedData.buyFxRate = (match.shares * oldFxRate + s * currentFxRate) / newShares;
        }
        // Preserve original buyDate on DCA — don't overwrite with today's date
        updateHolding(id, updatedData);
      }
    }

    onClose();
  }

  return (
    <Modal title="Log Transaction" onClose={onClose} size="md">
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
              <label className="block text-xs font-medium text-t-muted mb-1">Price per Share</label>
              <input
                type="number"
                value={pricePerShare}
                onChange={(e) => setPricePerShare(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
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
                {formatCurrency(total)}
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

          {/* Submission error (sell validation or FX not ready) */}
          {submitError && (
            <p role="alert" className="text-sm text-loss bg-loss-bg rounded-lg px-3 py-2">{submitError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Log Transaction
          </button>
        </form>
    </Modal>
  );
}
