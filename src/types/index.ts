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
}

export interface StockQuote {
  currentPrice: number;
  change: number;
  changePercent: number;
  lastUpdated: number;
}

export interface EnrichedHolding extends Holding {
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  allocation: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  totalDailyChange: number;
  totalDailyChangePercent: number;
  holdingCount: number;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  netWorthValue: number;
  portfolioValue: number;
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

export type TabId = 'dashboard' | 'holdings' | 'charts';

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
  value: number;
  percentage: number;
  holdingCount: number;
}

export interface NetWorthSummary {
  totalNetWorth: number;
  totalPortfolioValue: number;
  totalNonPortfolioValue: number;
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
  stock: { label: 'Stock', quantityLabel: 'Shares', badgeColor: 'text-blue-700', badgeBg: 'bg-blue-100' },
  etf: { label: 'ETF', quantityLabel: 'Shares', badgeColor: 'text-indigo-700', badgeBg: 'bg-indigo-100' },
  crypto: { label: 'Crypto', quantityLabel: 'Units', badgeColor: 'text-orange-700', badgeBg: 'bg-orange-100' },
  metal: { label: 'Metal', quantityLabel: 'Units', badgeColor: 'text-yellow-700', badgeBg: 'bg-yellow-100' },
  cash: { label: 'Cash', quantityLabel: 'Amount', badgeColor: 'text-green-700', badgeBg: 'bg-green-100' },
  custom: { label: 'Custom', quantityLabel: 'Units', badgeColor: 'text-slate-700', badgeBg: 'bg-slate-100' },
};
