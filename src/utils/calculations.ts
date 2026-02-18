import type { Holding, EnrichedHolding, PortfolioSummary, PriceCache, NetWorthSummary, CategoryBreakdown, CustomCategory } from '../types';
import { DEFAULT_CATEGORIES } from '../types';

function resolvePrice(h: Holding, prices: PriceCache): { currentPrice: number; change: number; changePercent: number } {
  const key = `${h.assetType}:${h.ticker}`;
  const quote = prices[key];

  if (h.assetType === 'cash') {
    return { currentPrice: 1, change: 0, changePercent: 0 };
  }

  if (quote?.currentPrice) {
    return {
      currentPrice: quote.currentPrice,
      change: quote.change ?? 0,
      changePercent: quote.changePercent ?? 0,
    };
  }

  if ((h.assetType === 'metal' || h.assetType === 'custom') && h.manualPrice) {
    return { currentPrice: h.manualPrice, change: 0, changePercent: 0 };
  }

  return { currentPrice: h.buyPrice, change: 0, changePercent: 0 };
}

export function enrichHoldings(
  holdings: Holding[],
  prices: PriceCache
): EnrichedHolding[] {
  const totalValue = holdings.reduce((sum, h) => {
    const { currentPrice } = resolvePrice(h, prices);
    return sum + currentPrice * h.shares;
  }, 0);

  return holdings.map((h) => {
    const { currentPrice, change, changePercent } = resolvePrice(h, prices);
    const marketValue = currentPrice * h.shares;
    const costBasis = h.buyPrice * h.shares;
    const gainLoss = marketValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    const dailyChange = change * h.shares;
    const dailyChangePercent = changePercent;
    const allocation = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;

    return {
      ...h,
      currentPrice,
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
  customCategories: CustomCategory[]
): NetWorthSummary {
  const totalNetWorth = allEnriched.reduce((sum, h) => sum + h.marketValue, 0);
  const portfolioHoldings = allEnriched.filter((h) => h.inPortfolio);
  const totalPortfolioValue = portfolioHoldings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalNonPortfolioValue = totalNetWorth - totalPortfolioValue;

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
      percentage: totalNetWorth > 0 ? (data.value / totalNetWorth) * 100 : 0,
      holdingCount: data.holdingCount,
    });
  }

  categoryBreakdown.sort((a, b) => b.value - a.value);

  return {
    totalNetWorth,
    totalPortfolioValue,
    totalNonPortfolioValue,
    categoryBreakdown,
    holdingCount: allEnriched.length,
    portfolioHoldingCount: portfolioHoldings.length,
  };
}
