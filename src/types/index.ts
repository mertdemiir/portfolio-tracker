export type AssetType = 'stock' | 'etf' | 'crypto' | 'metal' | 'cash' | 'custom';

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
  assetType: AssetType;
  manualPrice?: number;
  coinGeckoId?: string;
  inPortfolio: boolean;
  category: string;
  lastManualPriceUpdate?: string;
  skipStaleCheck?: boolean;
  isFavorite?: boolean;
  currency?: string; // ISO 4217, default 'USD'
  /**
   * Portfolio bucket this holding belongs to. Required post-schema-v1
   * (see migrations.ts) — the v1 migration backfills DEFAULT_PORTFOLIO_ID
   * where it was previously undefined, so `|| DEFAULT_PORTFOLIO_ID`
   * fallbacks across the app are no longer necessary.
   */
  portfolioId: string;
  buyFxRate?: number; // conversion factor at purchase time: 1 unit of holding currency = buyFxRate units of base currency
}

export interface StockQuote {
  currentPrice: number;
  change: number;
  changePercent: number;
  lastUpdated: number;
}

import type { Money } from './money';
export type { Money };

export interface EnrichedHolding extends Holding {
  /** Current price converted to base currency, as a Money value. */
  currentPrice: Money;
  /** Native-currency price (what the holding is denominated in). */
  nativeCurrentPrice: number;
  nativeCurrency: string;
  /** shares * currentPrice, in base currency. */
  marketValue: Money;
  /** shares * buyPrice (FX-adjusted via buyFxRate), in base currency. */
  costBasis: Money;
  /** marketValue − costBasis, in base currency. */
  gainLoss: Money;
  /** gainLoss / costBasis * 100. */
  gainLossPercent: number;
  /** today's change in base currency (approximate; only accurate for
   *  stocks/ETFs/crypto that expose a change field on the live quote). */
  dailyChange: Money;
  dailyChangePercent: number;
  /** Percentage of total market value in the set this holding belongs to. */
  allocation: number;
}

export interface PortfolioSummary {
  totalValue: Money;
  totalCostBasis: Money;
  totalGainLoss: Money;
  totalGainLossPercent: number;
  totalDailyChange: Money;
  totalDailyChangePercent: number;
  holdingCount: number;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  netWorthValue: number;
  portfolioValue?: number;
  totalLiabilities?: number;
  name?: string;
}

export interface TargetAllocation {
  categoryKey: string;
  targetPercent: number;
}

export interface Transaction {
  id: string;
  date: string;
  ticker: string;
  name: string;
  type: 'buy' | 'sell';
  shares: number;
  pricePerShare: number;
  total: number;
  notes?: string;
  costBasisPerShare?: number; // recorded on sell txns for realized P&L
  // Metadata for undo reconstruction (recorded on sell txns)
  assetType?: AssetType;
  category?: string;
  currency?: string;
  /**
   * Portfolio bucket this transaction belongs to. Required post-
   * schema-v1 migration (backfilled to DEFAULT_PORTFOLIO_ID for legacy
   * transactions that had it undefined).
   */
  portfolioId: string;
}

export interface FinnhubSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

export interface CoinGeckoSearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
}

export type TabId = 'dashboard' | 'holdings' | 'charts' | 'transactions' | 'simulator' | 'watchlist' | 'fire';

export interface Portfolio {
  id: string;
  name: string;
  createdDate: string;
}

export const DEFAULT_PORTFOLIO_ID = 'default';

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  coinGeckoId?: string;
  addedDate: string;
}

export interface NWMilestone {
  id: string;
  name: string;
  value: number;
}

export type LiabilityCategory = 'mortgage' | 'auto-loan' | 'student-loan' | 'credit-card' | 'personal-loan' | 'other-liability';

export interface Liability {
  id: string;
  name: string;
  category: LiabilityCategory;
  balance: number;
  interestRate?: number;
  minimumPayment?: number;
  currency?: string;
  startDate?: string;
  notes?: string;
}

export const LIABILITY_CATEGORIES: { key: LiabilityCategory; label: string; icon: string }[] = [
  { key: 'mortgage', label: 'Mortgage', icon: '🏠' },
  { key: 'auto-loan', label: 'Auto Loan', icon: '🚗' },
  { key: 'student-loan', label: 'Student Loan', icon: '🎓' },
  { key: 'credit-card', label: 'Credit Card', icon: '💳' },
  { key: 'personal-loan', label: 'Personal Loan', icon: '📝' },
  { key: 'other-liability', label: 'Other', icon: '📋' },
];

export interface TimelineAnnotation {
  id: string;
  date: string;
  label: string;
  color?: string;
}

export type CsvImportMode = 'holdings' | 'transactions';

export type BenchmarkId = 'spx' | 'btc' | 'gold';

export interface BenchmarkDataPoint {
  date: string;   // "YYYY-MM-DD"
  close: number;
}

export interface BenchmarkEnabled {
  spx: boolean;
  btc: boolean;
  gold: boolean;
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type ReportPeriod = 'last-month' | 'last-quarter' | 'last-year' | 'all-time';

export const BENCHMARK_CONFIG: Record<BenchmarkId, { label: string; color: string; shortLabel: string }> = {
  spx:  { label: 'S&P 500 (SPX)',  color: '#3b82f6', shortLabel: 'SPX'  },
  btc:  { label: 'Bitcoin (BTC)',   color: '#f97316', shortLabel: 'BTC'  },
  gold: { label: 'Gold (XAUUSD)',   color: '#eab308', shortLabel: 'Gold' },
};

export type ThemeId = 'light' | 'dark' | 'midnight' | 'heritage' | 'terminal';
export type ThemePreference = ThemeId | 'auto';

export const ACCENT_PRESETS: { name: string; color: string }[] = [
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Green', color: '#10b981' },
  { name: 'Purple', color: '#8b5cf6' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Indigo', color: '#6366f1' },
];

export interface FxRates {
  base: string;
  date: string;
  rates: Record<string, number>;
  fetchedAt?: number; // timestamp for staleness check
}

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '\u20AC' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '\u20BA' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '\u00A5' },
  { code: 'INR', name: 'Indian Rupee', symbol: '\u20B9' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '\u20A9' },
] as const;

export interface PriceCache {
  [key: string]: StockQuote;
}

export interface CustomCategory {
  key: string;
  label: string;
}

export interface CategoryBreakdown {
  key: string;
  label: string;
  value: Money;
  percentage: number;
  holdingCount: number;
}

export interface NetWorthSummary {
  totalNetWorth: Money;
  totalAssets: Money;
  totalLiabilities: Money;
  totalPortfolioValue: Money;
  totalNonPortfolioValue: Money;
  categoryBreakdown: CategoryBreakdown[];
  holdingCount: number;
  portfolioHoldingCount: number;
}

export const DEFAULT_CATEGORIES: { key: string; label: string }[] = [
  { key: 'investments', label: 'Investments' },
  { key: 'real-estate', label: 'Real Estate' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'cash-savings', label: 'Cash & Savings' },
  { key: 'precious-metals', label: 'Precious Metals' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'other', label: 'Other' },
];

export function getDefaultCategory(assetType: AssetType): string {
  switch (assetType) {
    case 'stock':
    case 'etf':
    case 'crypto':
      return 'investments';
    case 'metal':
      return 'precious-metals';
    case 'cash':
      return 'cash-savings';
    default:
      return 'other';
  }
}

export const ASSET_TYPE_CONFIG: Record<
  AssetType,
  { label: string; quantityLabel: string; badgeColor: string; badgeBg: string }
> = {
  stock: { label: 'Stock', quantityLabel: 'Shares', badgeColor: 'text-blue-500', badgeBg: 'bg-blue-500/10' },
  etf: { label: 'ETF', quantityLabel: 'Shares', badgeColor: 'text-violet-500', badgeBg: 'bg-violet-500/10' },
  crypto: { label: 'Crypto', quantityLabel: 'Units', badgeColor: 'text-amber-500', badgeBg: 'bg-amber-500/10' },
  metal: { label: 'Metal', quantityLabel: 'Units', badgeColor: 'text-yellow-500', badgeBg: 'bg-yellow-500/10' },
  cash: { label: 'Cash', quantityLabel: 'Amount', badgeColor: 'text-emerald-500', badgeBg: 'bg-emerald-500/10' },
  custom: { label: 'Custom', quantityLabel: 'Units', badgeColor: 'text-gray-500', badgeBg: 'bg-gray-500/10' },
};
