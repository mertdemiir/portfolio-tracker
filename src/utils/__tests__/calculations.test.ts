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
  };

  const prices: PriceCache = {
    'stock:AAPL': { currentPrice: 150, change: 1.5, changePercent: 1.0, lastUpdated: Date.now() },
  };

  it('enriches a single holding with market value and gain/loss', () => {
    const [enriched] = enrichHoldings([basicHolding], prices);
    expect(enriched.marketValue).toBe(1500);
    expect(enriched.costBasis).toBe(1000);
    expect(enriched.gainLoss).toBe(500);
    expect(enriched.gainLossPercent).toBe(50);
    expect(enriched.allocation).toBe(100);
  });

  it('calculates portfolio summary correctly', () => {
    const enriched = enrichHoldings([basicHolding], prices);
    const summary = calculateSummary(enriched);
    expect(summary.totalValue).toBe(1500);
    expect(summary.totalCostBasis).toBe(1000);
    expect(summary.totalGainLoss).toBe(500);
    expect(summary.holdingCount).toBe(1);
  });

  it('returns zero gainLossPercent when cost basis is zero', () => {
    const zeroCost: Holding = { ...basicHolding, buyPrice: 0 };
    const [enriched] = enrichHoldings([zeroCost], prices);
    expect(enriched.gainLossPercent).toBe(0);
  });

  it('falls back to buy price when no price data available', () => {
    const [enriched] = enrichHoldings([basicHolding], {});
    // No cached price → fall back to buyPrice
    expect(enriched.currentPrice).toBe(100);
    expect(enriched.marketValue).toBe(1000);
    expect(enriched.gainLoss).toBe(0);
  });

  it('net worth summary subtracts liabilities', () => {
    const enriched = enrichHoldings([basicHolding], prices);
    const nw = calculateNetWorthSummary(enriched, [], [
      { id: 'l1', name: 'Card', category: 'credit-card', balance: 500 },
    ]);
    expect(nw.totalAssets).toBe(1500);
    expect(nw.totalLiabilities).toBe(500);
    expect(nw.totalNetWorth).toBe(1000);
  });
});
