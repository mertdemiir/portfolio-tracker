import type {
  Holding,
  EnrichedHolding,
  PortfolioSummary,
  PriceCache,
  NetWorthSummary,
  CategoryBreakdown,
  CustomCategory,
  Liability,
  Money,
} from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import { money, zeroMoney, addMoney, sumMoney } from '../types/money';
import { LIVE_METAL_TICKERS } from './api';

/**
 * Base currency used by the calculation layer when it doesn't know any
 * better (empty inputs, first-run edge cases). Overridden per call when
 * convertToBase is provided (which implicitly tags its output as base).
 *
 * The calc layer treats every derived Money as "in base currency" — we
 * never produce mixed-currency Money from this module.
 */
const DEFAULT_BASE = 'USD';

export type ConvertFn = (amount: number, fromCurrency?: string) => number;
const identityConvert: ConvertFn = (amount) => amount;

interface ResolvedPrice {
  /** Price in base currency, as a raw number (Money tagged at caller). */
  baseAmount: number;
  /** Today's change in base currency as a raw number. */
  baseChange: number;
  /** Today's change as a percent. */
  changePercent: number;
  /** Native-currency price (what the holding's own currency quotes it at). */
  nativePrice: number;
  /** ISO currency code of the native price. */
  nativeCurrency: string;
}

function resolvePrice(
  h: Holding,
  prices: PriceCache,
  convert: ConvertFn = identityConvert,
): ResolvedPrice {
  const key = `${h.assetType}:${h.ticker}`;
  const quote = prices[key];
  const holdingCurrency = h.currency || 'USD';

  if (h.assetType === 'cash') {
    return {
      baseAmount: convert(1, holdingCurrency),
      baseChange: 0,
      changePercent: 0,
      nativePrice: 1,
      nativeCurrency: holdingCurrency,
    };
  }

  if (quote?.currentPrice) {
    const isLiveMetal = h.assetType === 'metal' && (LIVE_METAL_TICKERS as readonly string[]).includes(h.ticker);
    const priceCurrency = (h.assetType === 'stock' || h.assetType === 'etf' || h.assetType === 'crypto' || isLiveMetal)
      ? 'USD'
      : holdingCurrency;
    return {
      baseAmount: convert(quote.currentPrice, priceCurrency),
      baseChange: convert(quote.change ?? 0, priceCurrency),
      changePercent: quote.changePercent ?? 0,
      nativePrice: quote.currentPrice,
      nativeCurrency: priceCurrency,
    };
  }

  if ((h.assetType === 'metal' || h.assetType === 'custom') && h.manualPrice) {
    return {
      baseAmount: convert(h.manualPrice, holdingCurrency),
      baseChange: 0,
      changePercent: 0,
      nativePrice: h.manualPrice,
      nativeCurrency: holdingCurrency,
    };
  }

  return {
    baseAmount: convert(h.buyPrice, holdingCurrency),
    baseChange: 0,
    changePercent: 0,
    nativePrice: h.buyPrice,
    nativeCurrency: holdingCurrency,
  };
}

export function enrichHoldings(
  holdings: Holding[],
  prices: PriceCache,
  convertToBase?: ConvertFn,
  baseCurrency: string = DEFAULT_BASE,
): EnrichedHolding[] {
  const convert = convertToBase || identityConvert;

  // First pass: compute total market value (as a number in base currency)
  // so we can compute each holding's allocation share.
  let totalValueNum = 0;
  for (const h of holdings) {
    const { baseAmount } = resolvePrice(h, prices, convert);
    totalValueNum += baseAmount * h.shares;
  }

  return holdings.map((h) => {
    const { baseAmount, baseChange, changePercent, nativePrice, nativeCurrency } = resolvePrice(h, prices, convert);
    const holdingCurrency = h.currency || 'USD';
    // Historical FX rate if available (forward-only), otherwise live rate.
    // Guard: buyFxRate must be a positive number to be valid.
    const buyPriceConverted = (h.buyFxRate != null && h.buyFxRate > 0)
      ? h.buyPrice * h.buyFxRate
      : convert(h.buyPrice, holdingCurrency);

    const marketValueAmount = baseAmount * h.shares;
    const costBasisAmount = buyPriceConverted * h.shares;
    const gainLossAmount = marketValueAmount - costBasisAmount;
    const gainLossPercent = costBasisAmount > 0 ? (gainLossAmount / costBasisAmount) * 100 : 0;
    const dailyChangeAmount = baseChange * h.shares;
    const allocation = totalValueNum > 0 ? (marketValueAmount / totalValueNum) * 100 : 0;

    return {
      ...h,
      currentPrice: money(baseAmount, baseCurrency),
      nativeCurrentPrice: nativePrice,
      nativeCurrency,
      marketValue: money(marketValueAmount, baseCurrency),
      costBasis: money(costBasisAmount, baseCurrency),
      gainLoss: money(gainLossAmount, baseCurrency),
      gainLossPercent,
      dailyChange: money(dailyChangeAmount, baseCurrency),
      dailyChangePercent: changePercent,
      allocation,
    };
  });
}

export function calculateSummary(
  enriched: EnrichedHolding[],
  baseCurrency: string = DEFAULT_BASE,
): PortfolioSummary {
  const totalValue = sumMoney(enriched.map((h) => h.marketValue), baseCurrency);
  const totalCostBasis = sumMoney(enriched.map((h) => h.costBasis), baseCurrency);
  const totalGainLoss = sumMoney(enriched.map((h) => h.gainLoss), baseCurrency);
  const totalGainLossPercent =
    totalCostBasis.amount > 0 ? (totalGainLoss.amount / totalCostBasis.amount) * 100 : 0;
  const totalDailyChange = sumMoney(enriched.map((h) => h.dailyChange), baseCurrency);
  const prevValue = totalValue.amount - totalDailyChange.amount;
  const totalDailyChangePercent =
    prevValue > 0 ? (totalDailyChange.amount / prevValue) * 100 : 0;

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
  convertToBase: ConvertFn = identityConvert,
  baseCurrency: string = DEFAULT_BASE,
): NetWorthSummary {
  const totalAssets = sumMoney(allEnriched.map((h) => h.marketValue), baseCurrency);

  // Liabilities: convert each to base currency, then sum.
  const totalLiabilitiesAmount = liabilities.reduce(
    (sum, l) => sum + convertToBase(l.balance, l.currency || undefined),
    0,
  );
  const totalLiabilities = money(totalLiabilitiesAmount, baseCurrency);
  const totalNetWorth = money(totalAssets.amount - totalLiabilities.amount, baseCurrency);

  const portfolioHoldings = allEnriched.filter((h) => h.inPortfolio);
  const totalPortfolioValue = sumMoney(portfolioHoldings.map((h) => h.marketValue), baseCurrency);
  const totalNonPortfolioValue = money(
    totalAssets.amount - totalPortfolioValue.amount,
    baseCurrency,
  );

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const categoryMap = new Map<string, { value: Money; holdingCount: number }>();

  for (const h of allEnriched) {
    const cat = h.category || 'other';
    const existing = categoryMap.get(cat) || { value: zeroMoney(baseCurrency), holdingCount: 0 };
    existing.value = addMoney(existing.value, h.marketValue);
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
      percentage: totalAssets.amount > 0 ? (data.value.amount / totalAssets.amount) * 100 : 0,
      holdingCount: data.holdingCount,
    });
  }

  categoryBreakdown.sort((a, b) => b.value.amount - a.value.amount);

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
