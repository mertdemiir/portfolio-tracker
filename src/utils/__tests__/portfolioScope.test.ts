import { describe, it, expect } from 'vitest';
import { enrichHoldings, calculateSummary } from '../calculations';
import type { Holding, PriceCache } from '../../types';

/**
 * Regression tests for #20: the "filtered by active portfolio" accessor in
 * PortfolioContext used to include inPortfolio=false holdings when a
 * specific bucket was selected, but excluded them in the "all" scope.
 * This caused Dashboard Portfolio-Value cards to silently include
 * net-worth-only assets (house, car) whenever a specific portfolio was
 * selected.
 *
 * The fix: filter to inPortfolio=true uniformly across scopes. We verify
 * the filtering discipline here at the pure-calculation layer.
 */

const stockAAPL: Holding = {
  id: 'a', ticker: 'AAPL', name: 'Apple',
  shares: 10, buyPrice: 100, buyDate: '2024-01-01',
  assetType: 'stock', inPortfolio: true, category: 'investments',
  portfolioId: 'bucket-1',
};

const houseInBucket: Holding = {
  id: 'h', ticker: 'HOUSE', name: 'Primary Home',
  shares: 1, buyPrice: 500000, buyDate: '2020-01-01',
  assetType: 'custom', inPortfolio: false, category: 'real-estate',
  portfolioId: 'bucket-1',
};

const prices: PriceCache = {
  'stock:AAPL': { currentPrice: 150, change: 0, changePercent: 0, lastUpdated: Date.now() },
};

describe('portfolio scope filtering (regression: #20)', () => {
  it('inPortfolio filter excludes NW-only holdings', () => {
    const all = [stockAAPL, houseInBucket];
    const portfolioOnly = all.filter((h) => h.inPortfolio);
    expect(portfolioOnly).toEqual([stockAAPL]);
  });

  it('specific-bucket portfolio metrics exclude NW-only items', () => {
    // Simulate what the new filteredEnrichedHoldings produces for a
    // specific portfolio: (portfolioId match) AND inPortfolio=true
    const all = [stockAAPL, houseInBucket];
    const filteredForBucket1 = all.filter(
      (h) => h.portfolioId === 'bucket-1' && h.inPortfolio
    );
    const enriched = enrichHoldings(filteredForBucket1, prices);
    const summary = calculateSummary(enriched);
    // Only AAPL counted: 10 * 150 = 1500
    expect(summary.totalValue).toBe(1500);
    // House (500,000) not included
    expect(summary.totalValue).not.toBe(501500);
  });

  it('specific bucket with only NW-only items yields zero portfolio value', () => {
    const filtered = [houseInBucket].filter(
      (h) => h.portfolioId === 'bucket-1' && h.inPortfolio
    );
    const enriched = enrichHoldings(filtered, prices);
    const summary = calculateSummary(enriched);
    expect(summary.totalValue).toBe(0);
    expect(summary.holdingCount).toBe(0);
  });
});
