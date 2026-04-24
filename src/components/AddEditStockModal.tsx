import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, BarChart3, Bitcoin, CircleDollarSign, Gem, Package, Plus, AlertTriangle } from 'lucide-react';
import { SymbolSearch } from './SymbolSearch';
import { CryptoSearch } from './CryptoSearch';
import { ApiKeyPrompt } from './ApiKeyPrompt';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useFxRates } from '../hooks/useFxRates';
import { decideBuyFxRate } from '../utils/fxHelpers';
import { formatCurrency } from '../utils/formatters';
import { ASSET_TYPE_CONFIG, getDefaultCategory, DEFAULT_PORTFOLIO_ID, SUPPORTED_CURRENCIES } from '../types';
import type { Holding, AssetType } from '../types';

const METALS = [
  { ticker: 'XAU', name: 'Gold' },
  { ticker: 'XAG', name: 'Silver' },
  { ticker: 'XPT', name: 'Platinum' },
  { ticker: 'XPD', name: 'Palladium' },
] as const;

const CURRENCIES = [
  { ticker: 'USD', name: 'US Dollar' },
  { ticker: 'EUR', name: 'Euro' },
  { ticker: 'GBP', name: 'British Pound' },
  { ticker: 'JPY', name: 'Japanese Yen' },
  { ticker: 'CHF', name: 'Swiss Franc' },
  { ticker: 'CAD', name: 'Canadian Dollar' },
  { ticker: 'AUD', name: 'Australian Dollar' },
  { ticker: 'TRY', name: 'Turkish Lira' },
] as const;

const ASSET_TYPE_ICONS: Record<AssetType, typeof TrendingUp> = {
  stock: TrendingUp,
  etf: BarChart3,
  crypto: Bitcoin,
  metal: Gem,
  cash: CircleDollarSign,
  custom: Package,
};

interface AddEditStockModalProps {
  apiKey: string;
  holding?: Holding | null;
  onSave: (data: Omit<Holding, 'id'>) => void;
  onClose: () => void;
  /**
   * Optional: invoked when the user chooses "Edit existing instead" from the
   * duplicate-ticker warning. Caller is expected to close this modal and
   * reopen it in edit mode with the passed holding.
   */
  onEditExisting?: (holding: Holding) => void;
}

export function AddEditStockModal({ apiKey, holding, onSave, onClose, onEditExisting }: AddEditStockModalProps) {
  const { allCategories, addCustomCategory, setApiKey, hasApiKey, addTransaction, portfolios, activePortfolioId, baseCurrency, holdings } = usePortfolioContext();
  const { fxRates, convertToBase } = useFxRates(baseCurrency);

  const [assetType, setAssetType] = useState<AssetType>(holding?.assetType ?? 'stock');
  const [ticker, setTicker] = useState(holding?.ticker ?? '');
  const [name, setName] = useState(holding?.name ?? '');
  const [shares, setShares] = useState(holding?.shares.toString() ?? '');
  const [buyPrice, setBuyPrice] = useState(holding?.buyPrice.toString() ?? '');
  const [buyDate, setBuyDate] = useState(holding?.buyDate ?? new Date().toISOString().split('T')[0]);
  const [manualPrice, setManualPrice] = useState(holding?.manualPrice?.toString() ?? '');
  const [coinGeckoId, setCoinGeckoId] = useState(holding?.coinGeckoId ?? '');
  const [inPortfolio, setInPortfolio] = useState(holding?.inPortfolio ?? true);
  const [skipStaleCheck, setSkipStaleCheck] = useState(holding?.skipStaleCheck ?? false);
  const [category, setCategory] = useState(holding?.category ?? getDefaultCategory(holding?.assetType ?? 'stock'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [portfolioId, setPortfolioId] = useState(
    holding?.portfolioId ?? (activePortfolioId !== 'all' ? activePortfolioId : DEFAULT_PORTFOLIO_ID)
  );
  const [currency, setCurrency] = useState(holding?.currency || 'USD');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);

  const isEdit = !!holding;
  const config = ASSET_TYPE_CONFIG[assetType];

  // Duplicate detection: if the user is ADDING a holding with a ticker that
  // already exists in the chosen portfolio bucket, surface a warning so they
  // can choose to edit the existing lot instead of unknowingly creating two
  // separate positions for the same ticker.
  const duplicateHolding = useMemo<Holding | null>(() => {
    if (isEdit) return null;
    const tickerNorm = ticker.trim().toUpperCase();
    if (!tickerNorm) return null;
    const match = holdings.find(
      (h) => h.ticker.toUpperCase() === tickerNorm && h.portfolioId === portfolioId
    );
    return match ?? null;
  }, [holdings, ticker, portfolioId, isEdit]);

  // Auto-set buy price to 1 for cash
  useEffect(() => {
    if (assetType === 'cash' && !isEdit) {
      setBuyPrice('1');
    }
  }, [assetType, isEdit]);

  // Auto-default category based on asset type when creating
  useEffect(() => {
    if (!isEdit) {
      setCategory(getDefaultCategory(assetType));
    }
  }, [assetType, isEdit]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!ticker) errs.ticker = 'Symbol is required';
    if (!shares || parseFloat(shares) <= 0) errs.shares = 'Enter a positive number';
    if (assetType !== 'cash') {
      if (!buyPrice || parseFloat(buyPrice) <= 0) errs.buyPrice = 'Enter a positive price';
    }
    if (!buyDate) errs.buyDate = 'Date is required';
    if ((assetType === 'metal' || assetType === 'custom') && manualPrice && parseFloat(manualPrice) < 0) {
      errs.manualPrice = 'Price must be non-negative';
    }
    if (assetType === 'crypto' && !coinGeckoId) errs.ticker = 'Select a cryptocurrency';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const parsedShares = parseFloat(shares);
    const parsedPrice = assetType === 'cash' ? 1 : parseFloat(buyPrice);

    // Decide buyFxRate:
    //  - New holding: capture current live rate if available
    //  - Edit, currency unchanged: preserve the historical rate (fix for
    //    the buyFxRate-wipe-on-edit bug)
    //  - Edit, currency changed: recapture at current live rate
    const buyFxRate = decideBuyFxRate({
      newCurrency: currency || 'USD',
      baseCurrency,
      existingBuyFxRate: holding?.buyFxRate,
      existingCurrency: holding?.currency ?? (isEdit ? 'USD' : undefined),
      fxRates,
      convertToBase,
    });

    onSave({
      ticker,
      name: name || ticker,
      shares: parsedShares,
      buyPrice: parsedPrice,
      buyDate,
      assetType,
      inPortfolio,
      category,
      skipStaleCheck,
      portfolioId,
      ...(currency !== 'USD' || assetType === 'cash' ? { currency } : {}),
      ...(buyFxRate !== undefined ? { buyFxRate } : {}),
      ...(holding?.isFavorite ? { isFavorite: true } : {}),
      ...(manualPrice ? { manualPrice: parseFloat(manualPrice), lastManualPriceUpdate: new Date().toISOString().split('T')[0] } : {}),
      ...(coinGeckoId ? { coinGeckoId } : {}),
    });
    // Auto-log transaction for new holdings (Bug 9: include full metadata)
    if (!holding) {
      addTransaction({
        date: buyDate,
        ticker,
        name: name || ticker,
        type: 'buy',
        shares: parsedShares,
        pricePerShare: parsedPrice,
        total: parsedShares * parsedPrice,
        currency: currency || 'USD',
        assetType,
        category,
        portfolioId,
      });
    }
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const label = newCategoryLabel.trim();
    if (label) {
      addCustomCategory(label);
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setCategory(key);
      setNewCategoryLabel('');
      setShowAddCategory(false);
    }
  }

  // Check if this asset type needs API key and we don't have one
  const needsApiKey = (assetType === 'stock' || assetType === 'etf') && !hasApiKey;

  function renderSymbolInput() {
    if (isEdit) {
      return (
        <div>
          <label className="block text-sm font-medium text-t-secondary mb-1.5">Symbol</label>
          <input
            type="text"
            value={ticker}
            disabled
            className="w-full px-3 py-2 border border-b-default rounded-lg text-sm bg-surface text-t-muted"
          />
        </div>
      );
    }

    switch (assetType) {
      case 'stock':
      case 'etf':
        if (needsApiKey && !showApiKeyPrompt) {
          return (
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">Symbol</label>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600 mb-2">
                  An API key is needed for stock/ETF search & live prices.
                </p>
                <button
                  type="button"
                  onClick={() => setShowApiKeyPrompt(true)}
                  className="text-sm font-medium text-accent hover:text-accent-hover"
                >
                  Enter API Key
                </button>
              </div>
            </div>
          );
        }
        if (showApiKeyPrompt) {
          return (
            <div>
              <ApiKeyPrompt
                onSave={(key) => {
                  setApiKey(key);
                  setShowApiKeyPrompt(false);
                }}
                onClose={() => setShowApiKeyPrompt(false)}
              />
            </div>
          );
        }
        return (
          <div>
            <SymbolSearch
              apiKey={apiKey}
              assetType={assetType}
              onSelect={(symbol, desc) => {
                setTicker(symbol);
                setName(desc);
              }}
            />
            {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
          </div>
        );
      case 'crypto':
        return (
          <div>
            <CryptoSearch
              onSelect={(id, symbol, coinName) => {
                setCoinGeckoId(id);
                setTicker(symbol);
                setName(coinName);
              }}
            />
            {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
          </div>
        );
      case 'metal':
        return (
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1.5">Metal</label>
            <select
              value={ticker}
              onChange={(e) => {
                const metal = METALS.find((m) => m.ticker === e.target.value);
                setTicker(e.target.value);
                setName(metal?.name ?? e.target.value);
              }}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            >
              <option value="">Select a metal</option>
              {METALS.map((m) => (
                <option key={m.ticker} value={m.ticker}>
                  {m.name} ({m.ticker})
                </option>
              ))}
            </select>
            {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
          </div>
        );
      case 'cash':
        return (
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1.5">Currency</label>
            <select
              value={ticker}
              onChange={(e) => {
                const currency = CURRENCIES.find((c) => c.ticker === e.target.value);
                setTicker(e.target.value);
                setName(currency?.name ?? e.target.value);
              }}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            >
              <option value="">Select a currency</option>
              {CURRENCIES.map((c) => (
                <option key={c.ticker} value={c.ticker}>
                  {c.name} ({c.ticker})
                </option>
              ))}
            </select>
            {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
          </div>
        );
      case 'custom':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">Ticker</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. PRIV-FUND"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              {errors.ticker && <p className="text-red-500 text-xs mt-1">{errors.ticker}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Private Equity Fund"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
          </div>
        );
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Holding' : 'Add Holding'}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset type selector */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-2">Asset Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(ASSET_TYPE_CONFIG) as AssetType[]).map((type) => {
                  const Icon = ASSET_TYPE_ICONS[type];
                  const cfg = ASSET_TYPE_CONFIG[type];
                  const isSelected = assetType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setAssetType(type);
                        setTicker('');
                        setName('');
                        setCoinGeckoId('');
                        setManualPrice('');
                        setShowApiKeyPrompt(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        isSelected
                          ? 'border-accent bg-accent-light text-accent'
                          : 'border-b-default text-t-muted hover:bg-surface'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Symbol/selector input */}
          {renderSymbolInput()}

          {/* Quantity and Buy Price */}
          <div className={`grid gap-4 ${assetType === 'cash' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">
                {config.quantityLabel}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              {errors.shares && (
                <p className="text-red-500 text-xs mt-1">{errors.shares}</p>
              )}
            </div>
            {assetType !== 'cash' && (
              <div>
                <label className="block text-sm font-medium text-t-secondary mb-1.5">
                  Buy Price ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
                {errors.buyPrice && (
                  <p className="text-red-500 text-xs mt-1">{errors.buyPrice}</p>
                )}
              </div>
            )}
          </div>

          {/* Manual price for metal/custom */}
          {(assetType === 'metal' || assetType === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">
                Current Price ($)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="Enter current market price"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
              {errors.manualPrice && (
                <p className="text-red-500 text-xs mt-1">{errors.manualPrice}</p>
              )}
              <p className="text-xs text-t-faint mt-1">
                This price will be used for valuation until you update it.
              </p>
            </div>
          )}

          {/* Buy Date */}
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1.5">
              {assetType === 'cash' ? 'Date Added' : 'Buy Date'}
            </label>
            <input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            {errors.buyDate && (
              <p className="text-red-500 text-xs mt-1">{errors.buyDate}</p>
            )}
          </div>

          {/* Currency denomination */}
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1.5">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Category dropdown */}
          <div>
            <label className="block text-sm font-medium text-t-secondary mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            >
              {allCategories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
            {!showAddCategory ? (
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover mt-1.5"
              >
                <Plus className="w-3 h-3" />
                Add custom category
              </button>
            ) : (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  placeholder="Category name"
                  className="flex-1 px-2 py-1.5 border border-b-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory(e);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategoryLabel.trim()}
                  className="px-2 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddCategory(false); setNewCategoryLabel(''); }}
                  className="px-2 py-1.5 text-t-muted text-xs hover:text-t-secondary"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Portfolio selector */}
          {portfolios.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-t-secondary mb-1.5">Portfolio</label>
              <select
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* In Portfolio toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg">
            <div>
              <p className="text-sm font-medium text-t-secondary">Include in Portfolio</p>
              <p className="text-xs text-t-muted">Track as an investment, not just net worth</p>
            </div>
            <button
              type="button"
              onClick={() => setInPortfolio(!inPortfolio)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                inPortfolio ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-surface-card transition-transform ${
                  inPortfolio ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Skip stale price check toggle */}
          {assetType !== 'cash' && (
            <div className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg">
              <div>
                <p className="text-sm font-medium text-t-secondary">Skip Stale Price Warning</p>
                <p className="text-xs text-t-muted">Don't warn if price hasn't been updated</p>
              </div>
              <button
                type="button"
                onClick={() => setSkipStaleCheck(!skipStaleCheck)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  skipStaleCheck ? 'bg-accent' : 'bg-surface-active'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-surface-card transition-transform ${
                    skipStaleCheck ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Duplicate-ticker warning */}
          {duplicateHolding && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-amber-700 dark:text-amber-400">
                  You already own <strong>{duplicateHolding.ticker}</strong> in this portfolio
                  {' '}({duplicateHolding.shares} @ {formatCurrency(duplicateHolding.buyPrice, duplicateHolding.currency || 'USD')}).
                </p>
                {onEditExisting && (
                  <button
                    type="button"
                    onClick={() => onEditExisting(duplicateHolding)}
                    className="mt-1 text-xs font-medium text-accent hover:text-accent-hover underline"
                  >
                    Edit the existing lot instead
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-b-input rounded-lg text-sm font-medium text-t-secondary hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              {isEdit
                ? 'Save Changes'
                : duplicateHolding
                ? `Add as separate lot`
                : `Add ${config.label}`}
            </button>
          </div>
        </form>
    </Modal>
  );
}
