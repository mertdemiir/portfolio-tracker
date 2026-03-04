import type { Holding, EnrichedHolding, PortfolioSummary, PriceCache, NetWorthSummary, CategoryBreakdown, CustomCategory, Liability } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import { LIVE_METAL_TICKERS } from './api';

export type ConvertFn = (amount: number, fromCurrency?: string) => number;
const identityConvert: ConvertFn = (amount) => amount;

function resolvePrice(
  h: Holding,
  prices: PriceCache,
  convert: ConvertFn = identityConvert
): { currentPrice: number; change: number; changePercent: number; nativePrice: number; nativeCurrency: string } {
  const key = `${h.assetType}:${h.ticker}`;
  const quote = prices[key];
  const holdingCurrency = h.currency || 'USD';

  if (h.assetType === 'cash') {
    // Cash: 1 unit of the currency, convert to base
    return { currentPrice: convert(1, holdingCurrency), change: 0, changePercent: 0, nativePrice: 1, nativeCurrency: holdingCurrency };
  }

  if (quote?.currentPrice) {
    // API prices are in USD for stocks/crypto/live metals; convert to base
    const isLiveMetal = h.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(h.ticker);
    const priceCurrency = (h.assetType === 'stock' || h.assetType === 'etf' || h.assetType === 'crypto' || isLiveMetal) ? 'USD' : holdingCurrency;
    return {
      currentPrice: convert(quote.currentPrice, priceCurrency),
      change: convert(quote.change ?? 0, priceCurrency),
      changePercent: quote.changePercent ?? 0,
      nativePrice: quote.currentPrice,
      nativeCurrency: priceCurrency,
    };
  }

  if ((h.assetType === 'metal' || h.assetType === 'custom') && h.manualPrice) {
    return { currentPrice: convert(h.manualPrice, holdingCurrency), change: 0, changePercent: 0, nativePrice: h.manualPrice, nativeCurrency: holdingCurrency };
  }

  return { currentPrice: convert(h.buyPrice, holdingCurrency), change: 0, changePercent: 0, nativePrice: h.buyPrice, nativeCurrency: holdingCurrency };
}

export function enrichHoldings(
  holdings: Holding[],
  prices: PriceCache,
  convertToBase?: ConvertFn
): EnrichedHolding[] {
  const convert = convertToBase || identityConvert;

  const totalValue = holdings.reduce((sum, h) => {
    const { currentPrice } = resolvePrice(h, prices, convert);
    return sum + currentPrice * h.shares;
  }, 0);

  return holdings.map((h) => {
    const { currentPrice, change, changePercent, nativePrice, nativeCurrency } = resolvePrice(h, prices, convert);
    const holdingCurrency = h.currency || 'USD';
    // Use historical FX rate if available (forward-only), otherwise live rate.
    // Guard: buyFxRate must be a positive number to be valid.
    const buyPriceConverted = (h.buyFxRate != null && h.buyFxRate > 0)
      ? h.buyPrice * h.buyFxRate
      : convert(h.buyPrice, holdingCurrency);
    const marketValue = currentPrice * h.shares;
    const costBasis = buyPriceConverted * h.shares;
    const gainLoss = marketValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    const dailyChange = change * h.shares;
    const dailyChangePercent = changePercent;
    const allocation = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;

    return {
      ...h,
      currentPrice,
      nativeCurrentPrice: nativePrice,
      nativeCurrency,
      marketValue,
      costBasis,
      gainLoss,
      gainLossPercent,
      dailyChange,
      dailyChangePercent,
      allocation,
    };
  });
}

export function calculateSummary(enriched: EnrichedHolding[]): PortfolioSummary {
  const totalValue = enriched.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCostBasis = enriched.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPercent =
    totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const totalDailyChange = enriched.reduce((sum, h) => sum + h.dailyChange, 0);
  const prevValue = totalValue - totalDailyChange;
  const totalDailyChangePercent =
    prevValue > 0 ? (totalDailyChange / prevValue) * 100 : 0;

  return {
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPercent,
    totalDailyChange,
    totalDailyChangePercent,
    holdingCount: enriched.length,
  };
}

export function calculateNetWorthSummary(
  allEnriched: EnrichedHolding[],
  customCategories: CustomCategory[],
  liabilities: Liability[] = [],
  convertToBase: ConvertFn = identityConvert
): NetWorthSummary {
  const totalAssets = allEnriched.reduce((sum, h) => sum + h.marketValue, 0);
  const totalLiabilities = liabilities.reduce(
    (sum, l) => sum + convertToBase(l.balance, l.currency || undefined),
    0
  );
  const totalNetWorth = totalAssets - totalLiabilities;
  const portfolioHoldings = allEnriched.filter((h) => h.inPortfolio);
  const totalPortfolioValue = portfolioHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalNonPortfolioValue = totalAssets - totalPortfolioValue;

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const categoryMap = new Map<string, { value: number; holdingCount: number }>();

  for (const h of allEnriched) {
    const cat = h.category || 'other';
    const existing = categoryMap.get(cat) || { value: 0, holdingCount: 0 };
    existing.value += h.marketValue;
    existing.holdingCount += 1;
    categoryMap.set(cat, existing);
  }

  const categoryBreakdown: CategoryBreakdown[] = [];
  for (const [key, data] of categoryMap.entries()) {
    const catDef = allCategories.find((c) => c.key === key);
    categoryBreakdown.push({
      key,
      label: catDef?.label ?? key,
      value: data.value,
      percentage: totalAssets > 0 ? (data.value / totalAssets) * 100 : 0,
      holdingCount: data.holdingCount,
    });
  }

  categoryBreakdown.sort((a, b) => b.value - a.value);

  return {
    totalNetWorth,
    totalAssets,
    totalLiabilities,
    totalPortfolioValue,
    totalNonPortfolioValue,
    categoryBreakdown,
    holdingCount: allEnriched.length,
    portfolioHoldingCount: portfolioHoldings.length,
  };
}
