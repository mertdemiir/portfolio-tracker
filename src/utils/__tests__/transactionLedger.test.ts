import { describe, it, expect } from 'vitest';
import { recomputeHoldingFromLedger } from '../transactionLedger';

describe('recomputeHoldingFromLedger', () => {
  it('returns zeros for an empty ledger', () => {
    const r = recomputeHoldingFromLedger([]);
    expect(r.netShares).toBe(0);
    expect(r.buyPrice).toBe(0);
  });

  it('computes weighted average buyPrice across multiple buys', () => {
    // 10 @ $100 + 5 @ $200 = 20 shares at $133.33 avg... wait: 10+5=15 shares,
    // cost = 10*100 + 5*200 = 2000, avg = 2000/15 = 133.33
    const r = recomputeHoldingFromLedger([
      { type: 'buy', shares: 10, pricePerShare: 100 },
      { type: 'buy', shares: 5, pricePerShare: 200 },
    ]);
    expect(r.netShares).toBe(15);
    expect(r.buyPrice).toBeCloseTo(133.33, 2);
  });

  it('subtracts sell shares from net, but sells do not affect weighted avg', () => {
    const r = recomputeHoldingFromLedger([
      { type: 'buy', shares: 10, pricePerShare: 100 },
      { type: 'sell', shares: 3, pricePerShare: 150 }, // price-per-share on sells is unrealized anyway
      { type: 'buy', shares: 5, pricePerShare: 200 },
    ]);
    // net: 10 + 5 - 3 = 12
    expect(r.netShares).toBe(12);
    // weighted avg buys only: (10*100 + 5*200) / (10+5) = 2000/15 = 133.33
    expect(r.buyPrice).toBeCloseTo(133.33, 2);
  });

  it('returns buyPrice=0 when only sells exist (no cost-basis info)', () => {
    const r = recomputeHoldingFromLedger([
      { type: 'sell', shares: 3, pricePerShare: 150 },
    ]);
    expect(r.netShares).toBe(-3);
    expect(r.buyPrice).toBe(0);
  });

  it('ignores non-buy/sell transaction types', () => {
    const r = recomputeHoldingFromLedger([
      { type: 'buy', shares: 10, pricePerShare: 100 },
      { type: 'deposit', shares: 5000, pricePerShare: 1 },
      { type: 'interest', shares: 50, pricePerShare: 1 },
      { type: 'withdrawal', shares: 100, pricePerShare: 1 },
      { type: 'correction', shares: 1, pricePerShare: 0 },
    ]);
    expect(r.netShares).toBe(10);
    expect(r.buyPrice).toBe(100);
  });

  it('handles fractional shares without drift on a simple ledger', () => {
    const r = recomputeHoldingFromLedger([
      { type: 'buy', shares: 0.1, pricePerShare: 50000 }, // $5000
      { type: 'buy', shares: 0.2, pricePerShare: 60000 }, // $12000
    ]);
    // net = 0.3, cost = 17000, avg = 56666.67
    expect(r.netShares).toBeCloseTo(0.3, 10);
    expect(r.buyPrice).toBeCloseTo(56666.666, 2);
  });
});
