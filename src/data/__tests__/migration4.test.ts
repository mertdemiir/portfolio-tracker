import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { writeAppMeta } from '../schema';

/**
 * Integration tests for schema migration 4: reconcile each Holding's
 * ledger with its stored shape by appending synthetic top-up txns
 * where the two disagree.
 *
 * Tests run the full migration pipeline (1 → 2 → 3 → 4) so we check
 * end-state behavior, not just migration 4 in isolation.
 */
describe('migration 4 — reconcile holding ledger with storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion3() {
    writeAppMeta({
      schemaVersion: 3,
      lastAppVersion: '1.4.2',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.4.2',
      dataBackend: 'localStorage',
    });
  }

  it('adds a synthetic buy when derived shares = 0 (closed-and-reopened with no rebuy txn)', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        // Stored: currently holds 50 sh @ $70 — but the ledger doesn't reflect the rebuy.
        { id: 'h1', ticker: 'XLE', name: 'Energy ETF', shares: 50, buyPrice: 70,
          buyDate: '2024-09-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        // Closed legacy cycle — net 0 shares after the chronological-reset.
        { id: 't1', date: '2022-01-15', ticker: 'XLE', name: 'Energy ETF', type: 'buy',
          shares: 100, pricePerShare: 50, total: 5000, portfolioId: 'default', holdingId: 'h1' },
        { id: 't2', date: '2023-12-10', ticker: 'XLE', name: 'Energy ETF', type: 'sell',
          shares: 100, pricePerShare: 80, total: 8000, costBasisPerShare: 50,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    const r = await runMigrations();
    expect(r.failed).toBeNull();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const synthetics = txns.filter((t: { synthetic?: boolean }) => t.synthetic);
    expect(synthetics).toHaveLength(1);
    const syn = synthetics[0];
    expect(syn.type).toBe('buy');
    expect(syn.shares).toBe(50);
    expect(syn.pricePerShare).toBe(70); // matches stored.buyPrice
    expect(syn.holdingId).toBe('h1');
    expect(syn.date).toBe('2024-09-01');
    expect(syn.notes).toMatch(/migration 4/);
  });

  it('chooses the synthetic price so weighted-avg matches stored.buyPrice (partial gap case)', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        // Stored: 18.89 sh @ $95.35
        { id: 'h1', ticker: 'REMX', name: 'Rare Earth ETF', shares: 18.89, buyPrice: 95.35,
          buyDate: '2024-01-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    // Existing ledger contributes 3.55 sh @ $101.44 (post-buyDate so it's in the open cycle).
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-02-01', ticker: 'REMX', name: 'Rare Earth ETF', type: 'buy',
          shares: 3.55, pricePerShare: 101.44, total: 360.112,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const synthetic = txns.find((t: { synthetic?: boolean }) => t.synthetic);
    expect(synthetic).toBeDefined();
    expect(synthetic.type).toBe('buy');
    // Gap = 18.89 - 3.55 = 15.34
    expect(synthetic.shares).toBeCloseTo(15.34, 4);

    // Verify the post-migration weighted-avg equals stored.buyPrice.
    const buys = txns.filter((t: { type: string }) => t.type === 'buy');
    const totalShares = buys.reduce((s: number, t: { shares: number }) => s + t.shares, 0);
    const totalCost = buys.reduce(
      (s: number, t: { shares: number; pricePerShare: number }) => s + t.shares * t.pricePerShare,
      0,
    );
    expect(totalCost / totalShares).toBeCloseTo(95.35, 4);
  });

  it('adds a synthetic sell when derived shares > stored shares', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 5, buyPrice: 150,
          buyDate: '2024-01-01', assetType: 'stock', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    // Ledger says 10 sh; stored says 5 — user manually decreased shares.
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-01-01', ticker: 'AAPL', name: 'Apple', type: 'buy',
          shares: 10, pricePerShare: 150, total: 1500, portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const synthetic = txns.find((t: { synthetic?: boolean }) => t.synthetic);
    expect(synthetic).toBeDefined();
    expect(synthetic.type).toBe('sell');
    expect(synthetic.shares).toBe(5);
    expect(synthetic.pricePerShare).toBe(150); // costBasisPerShare for zero P&L
  });

  it('is a no-op when ledger and storage already agree', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150,
          buyDate: '2024-01-01', assetType: 'stock', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-01-01', ticker: 'AAPL', name: 'Apple', type: 'buy',
          shares: 10, pricePerShare: 150, total: 1500, portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    expect(txns.filter((t: { synthetic?: boolean }) => t.synthetic)).toHaveLength(0);
    expect(txns).toHaveLength(1);
  });

  it('skips cash holdings (different ledger model)', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'c1', ticker: 'CHECKING', name: 'Chase', shares: 1000, buyPrice: 1,
          buyDate: '2024-01-01', assetType: 'cash', inPortfolio: false,
          category: 'cash-savings', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    // Migration 3 may have added a synthetic buy for the cash holding (it
    // does for any holding with no buy). Migration 4 should NOT add another.
    const m4Synthetics = txns.filter(
      (t: { notes?: string }) => typeof t.notes === 'string' && /migration 4/.test(t.notes),
    );
    expect(m4Synthetics).toHaveLength(0);
  });

  it('is idempotent: re-running after success is a no-op', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'XLE', shares: 50, buyPrice: 70, buyDate: '2024-09-01',
          assetType: 'etf', inPortfolio: true, category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    await runMigrations();
    const after1 = localStorage.getItem('transactions');

    const r2 = await runMigrations();
    expect(r2.ran).toHaveLength(0);
    expect(localStorage.getItem('transactions')).toBe(after1);
  });

  it('handles multiple holdings in a single pass', async () => {
    setMetaAtVersion3();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'XLE', shares: 50, buyPrice: 70, buyDate: '2024-01-01',
          assetType: 'etf', inPortfolio: true, category: 'investments', portfolioId: 'default' },
        { id: 'h2', ticker: 'XLI', shares: 30, buyPrice: 100, buyDate: '2024-01-01',
          assetType: 'etf', inPortfolio: true, category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const m4 = txns.filter(
      (t: { notes?: string }) => typeof t.notes === 'string' && /migration 4/.test(t.notes),
    );
    expect(m4).toHaveLength(2);
    expect(m4.find((t: { ticker: string }) => t.ticker === 'XLE').shares).toBe(50);
    expect(m4.find((t: { ticker: string }) => t.ticker === 'XLI').shares).toBe(30);
  });
});
