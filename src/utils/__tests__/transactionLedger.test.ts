import { describe, it, expect } from 'vitest';
import { recomputeHoldingFromLedger, deriveHolding } from '../transactionLedger';
import type { Transaction, AssetType } from '../../types';

// Helper for terse test fixtures.
function txn(p: Partial<Transaction> & { id: string; type: Transaction['type'] }): Transaction {
  return {
    date: '2024-01-01',
    ticker: 'AAPL',
    name: 'Apple',
    shares: 0,
    pricePerShare: 0,
    total: 0,
    portfolioId: 'default',
    ...p,
  };
}

function holdingShape(over: Partial<{ id: string; ticker: string; portfolioId: string; assetType: AssetType }> = {}) {
  return {
    id: 'h1',
    ticker: 'AAPL',
    portfolioId: 'default',
    assetType: 'stock' as AssetType,
    ...over,
  };
}

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

describe('deriveHolding', () => {
  it('returns zero state for a holding with no matching txns', () => {
    const r = deriveHolding(holdingShape(), []);
    expect(r.shares).toBe(0);
    expect(r.buyPrice).toBe(0);
    expect(r.realizedPnl).toBe(0);
    expect(r.matchedTxnCount).toBe(0);
    expect(r.buyFxRate).toBeUndefined();
  });

  it('matches by holdingId when present (preferred over ticker fallback)', () => {
    const txns: Transaction[] = [
      // wrong holdingId — should NOT contribute even though ticker matches
      txn({ id: 't1', holdingId: 'h-other', type: 'buy', shares: 999, pricePerShare: 1 }),
      // correct holdingId
      txn({ id: 't2', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }),
    ];
    const r = deriveHolding(holdingShape(), txns);
    expect(r.shares).toBe(10);
    expect(r.buyPrice).toBe(100);
    expect(r.matchedTxnCount).toBe(1);
  });

  it('falls back to (ticker, portfolioId) when txn lacks holdingId', () => {
    const txns: Transaction[] = [
      // no holdingId — fallback by ticker + portfolioId
      txn({ id: 't1', type: 'buy', shares: 10, pricePerShare: 100 }),
      // wrong portfolio — excluded
      txn({ id: 't2', type: 'buy', shares: 50, pricePerShare: 50, portfolioId: 'other' }),
    ];
    const r = deriveHolding(holdingShape(), txns);
    expect(r.shares).toBe(10);
    expect(r.matchedTxnCount).toBe(1);
  });

  it('computes weighted-avg buyPrice across DCA buys', () => {
    const txns: Transaction[] = [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }), // $1000
      txn({ id: 't2', holdingId: 'h1', type: 'buy', shares: 5, pricePerShare: 200 }),  // $1000
    ];
    const r = deriveHolding(holdingShape(), txns);
    expect(r.shares).toBe(15);
    expect(r.buyPrice).toBeCloseTo(2000 / 15, 6); // $133.33
  });

  it('partial sell: shares decrease, weighted-avg buyPrice unchanged (moving-average model)', () => {
    const txns: Transaction[] = [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }),
      txn({ id: 't2', holdingId: 'h1', type: 'sell', shares: 3, pricePerShare: 150, costBasisPerShare: 100 }),
    ];
    const r = deriveHolding(holdingShape(), txns);
    expect(r.shares).toBe(7);
    expect(r.buyPrice).toBe(100);
    expect(r.realizedPnl).toBe((150 - 100) * 3); // +150
  });

  it('full sell + rebuy: shares & weighted-avg from rebuy only', () => {
    const txns: Transaction[] = [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }),
      txn({ id: 't2', holdingId: 'h1', type: 'sell', shares: 10, pricePerShare: 150, costBasisPerShare: 100 }),
      txn({ id: 't3', holdingId: 'h1', type: 'buy', shares: 5, pricePerShare: 200 }),
    ];
    const r = deriveHolding(holdingShape(), txns);
    expect(r.shares).toBe(5);
    // weighted avg of all buys = (10*100 + 5*200) / (10+5) = 2000/15
    expect(r.buyPrice).toBeCloseTo(2000 / 15, 6);
    expect(r.realizedPnl).toBe(500); // (150-100)*10
  });

  it('weighted-avg buyFxRate from buys that carry one; undefined when none do', () => {
    const noFx = deriveHolding(holdingShape(), [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }),
    ]);
    expect(noFx.buyFxRate).toBeUndefined();

    const withFx = deriveHolding(holdingShape(), [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100, buyFxRate: 1.1 }),
      txn({ id: 't2', holdingId: 'h1', type: 'buy', shares: 5, pricePerShare: 100, buyFxRate: 1.2 }),
    ]);
    // weighted avg: (10*1.1 + 5*1.2) / 15 = 17 / 15 ≈ 1.133
    expect(withFx.buyFxRate).toBeCloseTo(17 / 15, 6);
  });

  it('cash holding: deposit/interest add, withdrawal subtracts, correction is signed', () => {
    const r = deriveHolding(holdingShape({ assetType: 'cash', ticker: 'CHECKING' }), [
      txn({ id: 't1', holdingId: 'h1', ticker: 'CHECKING', type: 'buy', shares: 1000, pricePerShare: 1 }),
      txn({ id: 't2', holdingId: 'h1', ticker: 'CHECKING', type: 'deposit', shares: 500, pricePerShare: 1 }),
      txn({ id: 't3', holdingId: 'h1', ticker: 'CHECKING', type: 'withdrawal', shares: 200, pricePerShare: 1 }),
      txn({ id: 't4', holdingId: 'h1', ticker: 'CHECKING', type: 'interest', shares: 12, pricePerShare: 1 }),
      txn({ id: 't5', holdingId: 'h1', ticker: 'CHECKING', type: 'correction', shares: -5, pricePerShare: 0 }),
    ]);
    // 1000 (legacy synthetic buy) + 500 - 200 + 12 + (-5) = 1307
    expect(r.shares).toBe(1307);
    expect(r.buyPrice).toBe(1); // fixed for cash
  });

  it('non-cash holding ignores deposit/withdrawal/interest/correction', () => {
    const r = deriveHolding(holdingShape(), [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }),
      // these would only land on a cash holding under normal flow; ignore defensively
      txn({ id: 't2', holdingId: 'h1', type: 'deposit', shares: 999, pricePerShare: 1 }),
      txn({ id: 't3', holdingId: 'h1', type: 'withdrawal', shares: 999, pricePerShare: 1 }),
      txn({ id: 't4', holdingId: 'h1', type: 'interest', shares: 999, pricePerShare: 1 }),
      txn({ id: 't5', holdingId: 'h1', type: 'correction', shares: 999, pricePerShare: 0 }),
    ]);
    expect(r.shares).toBe(10);
    expect(r.buyPrice).toBe(100);
  });

  it('realized P&L only counts sells with recorded costBasisPerShare (legacy data tolerated)', () => {
    const r = deriveHolding(holdingShape(), [
      txn({ id: 't1', holdingId: 'h1', type: 'buy', shares: 10, pricePerShare: 100 }),
      // legacy sell without costBasisPerShare — should not crash, just contributes 0 to PnL
      txn({ id: 't2', holdingId: 'h1', type: 'sell', shares: 3, pricePerShare: 150 }),
    ]);
    expect(r.shares).toBe(7);
    expect(r.realizedPnl).toBe(0);
  });
});
