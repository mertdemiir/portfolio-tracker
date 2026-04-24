import { describe, it, expect } from 'vitest';
import { enrichHoldings, calculateSummary, calculateNetWorthSummary } from '../calculations';
import type { Holding, PriceCache } from '../../types';

describe('calculations smoke tests', () => {
  const basicHolding: Holding = {
    id: 'h1',
    ticker: 'AAPL',
    name: 'Apple',
    shares: 10,
    buyPrice: 100,
    buyDate: '2024-01-01',
    assetType: 'stock',
    inPortfolio: true,
    category: 'investments',
    portfolioId: 'default',
  };

  const prices: PriceCache = {
    'stock:AAPL': { currentPrice: 150, change: 1.5, changePercent: 1.0, lastUpdated: Date.now() },
  };

  it('enriches a single holding with Money-typed market value and gain/loss', () => {
    const [enriched] = enrichHoldings([basicHolding], prices);
    expect(enriched.marketValue).toEqual({ amount: 1500, currency: 'USD' });
    expect(enriched.costBasis).toEqual({ amount: 1000, currency: 'USD' });
    expect(enriched.gainLoss).toEqual({ amount: 500, currency: 'USD' });
    expect(enriched.gainLossPercent).toBe(50);
    expect(enriched.allocation).toBe(100);
  });

  it('calculates portfolio summary as Money totals', () => {
    const enriched = enrichHoldings([basicHolding], prices);
    const summary = calculateSummary(enriched);
    expect(summary.totalValue).toEqual({ amount: 1500, currency: 'USD' });
    expect(summary.totalCostBasis).toEqual({ amount: 1000, currency: 'USD' });
    expect(summary.totalGainLoss).toEqual({ amount: 500, currency: 'USD' });
    expect(summary.holdingCount).toBe(1);
  });

  it('returns zero gainLossPercent when cost basis is zero', () => {
    const zeroCost: Holding = { ...basicHolding, buyPrice: 0 };
    const [enriched] = enrichHoldings([zeroCost], prices);
    expect(enriched.gainLossPercent).toBe(0);
  });

  it('falls back to buy price when no price data available', () => {
    const [enriched] = enrichHoldings([basicHolding], {});
    expect(enriched.currentPrice.amount).toBe(100);
    expect(enriched.marketValue.amount).toBe(1000);
    expect(enriched.gainLoss.amount).toBe(0);
  });

  it('net worth summary subtracts liabilities', () => {
    const enriched = enrichHoldings([basicHolding], prices);
    const nw = calculateNetWorthSummary(enriched, [], [
      { id: 'l1', name: 'Card', category: 'credit-card', balance: 500 },
    ]);
    expect(nw.totalAssets).toEqual({ amount: 1500, currency: 'USD' });
    expect(nw.totalLiabilities).toEqual({ amount: 500, currency: 'USD' });
    expect(nw.totalNetWorth).toEqual({ amount: 1000, currency: 'USD' });
  });

  it('carries the requested base currency through on every returned Money', () => {
    const enriched = enrichHoldings([basicHolding], prices, undefined, 'EUR');
    expect(enriched[0].marketValue.currency).toBe('EUR');
    const summary = calculateSummary(enriched, 'EUR');
    expect(summary.totalValue.currency).toBe('EUR');
    const nw = calculateNetWorthSummary(enriched, [], [], undefined, 'EUR');
    expect(nw.totalAssets.currency).toBe('EUR');
  });
});
