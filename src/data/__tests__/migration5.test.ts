import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { writeAppMeta } from '../schema';
import { deriveHolding } from '../../utils/transactionLedger';

/**
 * Integration tests for schema migration 5: brute-force ledger
 * reconciliation that fixes the v1.4.3 migration-4 date bug.
 *
 * Tests run the full migration pipeline (1 → 2 → 3 → 4 → 5) so we
 * verify the end state, not just migration 5 in isolation.
 */
describe('migration 5 — brute-force ledger reconciliation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion4() {
    writeAppMeta({
      schemaVersion: 4,
      lastAppVersion: '1.4.4',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.4.4',
      dataBackend: 'localStorage',
    });
  }

  it('fixes the migration-4 date-bug case: synthetic gets dated AFTER the closing sell', async () => {
    // Reproduces the user's XLE state on v1.4.3:
    //   stored 239 sh, ledger has legacy buy + closing sell, plus a
    //   migration-4 synthetic dated at buyDate (which sits BEFORE the
    //   closing sell in chronological order). Migration 5 should wipe
    //   the bad synthetic and re-add one dated AFTER the closing sell.
    setMetaAtVersion4();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'XLE', name: 'Energy', shares: 239, buyPrice: 55.73,
          buyDate: '2024-09-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        // Migration-4 synthetic (date = buyDate, sits before the closing sell)
        { id: 'mig4-syn', date: '2024-09-01', ticker: 'XLE', name: 'Energy', type: 'buy',
          shares: 239, pricePerShare: 55.73, total: 13319.47, portfolioId: 'default',
          holdingId: 'h1', synthetic: true,
          notes: 'Phase 3 reconciliation (migration 4): brings the transaction ledger in line.',
          assetType: 'etf', category: 'investments' },
        // Real legacy buy + sell (sell is AFTER the synthetic chronologically)
        { id: 't1', date: '2025-01-15', ticker: 'XLE', name: 'Energy', type: 'buy',
          shares: 100, pricePerShare: 50, total: 5000, portfolioId: 'default', holdingId: 'h1' },
        { id: 't2', date: '2025-12-10', ticker: 'XLE', name: 'Energy', type: 'sell',
          shares: 165.8, pricePerShare: 80, total: 13264, costBasisPerShare: 50,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    const r = await runMigrations();
    expect(r.failed).toBeNull();

    // After migration 5: prior synthetic gone, replaced with one dated
    // AT OR AFTER the latest contributing txn date.
    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const synthetics = txns.filter(
      (t: { synthetic?: boolean; holdingId?: string }) => t.synthetic && t.holdingId === 'h1',
    );
    expect(synthetics).toHaveLength(1);
    expect(synthetics[0].date >= '2025-12-10').toBe(true);

    // And critically: deriveHolding now agrees with stored.
    const holding = JSON.parse(localStorage.getItem('portfolio-holdings')!)[0];
    const d = deriveHolding(
      { id: holding.id, ticker: holding.ticker, portfolioId: holding.portfolioId,
        assetType: holding.assetType, buyDate: holding.buyDate },
      txns,
    );
    expect(d.shares).toBeCloseTo(239, 6);
  });

  it('residual buyPrice gap (REMX-shape): re-prices the synthetic so weighted-avg matches stored', async () => {
    setMetaAtVersion4();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'REMX', name: 'Rare Earth', shares: 18.8925, buyPrice: 95.35,
          buyDate: '2024-01-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        // A bad migration-4 synthetic that didn't quite hit weighted-avg
        { id: 'mig4-syn', date: '2024-01-01', ticker: 'REMX', name: 'Rare Earth', type: 'buy',
          shares: 15.34, pricePerShare: 93.94, total: 1441.04, portfolioId: 'default',
          holdingId: 'h1', synthetic: true, notes: 'Phase 3 reconciliation (migration 4): ...',
          assetType: 'etf' },
        // Real existing buy
        { id: 't1', date: '2024-02-01', ticker: 'REMX', name: 'Rare Earth', type: 'buy',
          shares: 3.5524999999999993, pricePerShare: 101.44, total: 360.30,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const buys = txns.filter((t: { ticker: string; type: string }) => t.ticker === 'REMX' && t.type === 'buy');
    const totalShares = buys.reduce((s: number, t: { shares: number }) => s + t.shares, 0);
    const totalCost = buys.reduce(
      (s: number, t: { shares: number; pricePerShare: number }) => s + t.shares * t.pricePerShare,
      0,
    );
    expect(totalShares).toBeCloseTo(18.8925, 6);
    expect(totalCost / totalShares).toBeCloseTo(95.35, 6);
  });

  it('is idempotent: re-running on already-reconciled data wipes + re-adds an identical synthetic', async () => {
    setMetaAtVersion4();
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

    // The runner won't re-run mig 5 because schemaVersion is now 5.
    // We bypass that by manually resetting and re-running.
    const meta = JSON.parse(localStorage.getItem('app-meta')!);
    meta.schemaVersion = 4;
    localStorage.setItem('app-meta', JSON.stringify(meta));

    await runMigrations();
    const after2 = JSON.parse(localStorage.getItem('transactions')!);
    const after1Parsed = JSON.parse(after1!);

    // Same number of synthetics, same shares + price (modulo a different uuid).
    const syn1 = after1Parsed.filter((t: { synthetic?: boolean }) => t.synthetic);
    const syn2 = after2.filter((t: { synthetic?: boolean }) => t.synthetic);
    expect(syn2.length).toBe(syn1.length);
    expect(syn2[0].shares).toBe(syn1[0].shares);
    expect(syn2[0].pricePerShare).toBe(syn1[0].pricePerShare);
  });

  it('skips holdings that already agree (no-op for clean data)', async () => {
    setMetaAtVersion4();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', shares: 10, buyPrice: 150, buyDate: '2024-01-01',
          assetType: 'stock', inPortfolio: true, category: 'investments', portfolioId: 'default' },
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
    expect(txns).toHaveLength(1); // unchanged
  });

  it('handles multiple holdings independently', async () => {
    setMetaAtVersion4();
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
    const synXle = txns.find((t: { ticker: string; synthetic?: boolean }) => t.ticker === 'XLE' && t.synthetic);
    const synXli = txns.find((t: { ticker: string; synthetic?: boolean }) => t.ticker === 'XLI' && t.synthetic);
    expect(synXle.shares).toBe(50);
    expect(synXli.shares).toBe(30);
  });

  it('skips cash holdings (different ledger model)', async () => {
    setMetaAtVersion4();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'c1', ticker: 'CHECKING', shares: 1000, buyPrice: 1, buyDate: '2024-01-01',
          assetType: 'cash', inPortfolio: false, category: 'cash-savings', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const m5 = txns.filter(
      (t: { notes?: string }) => typeof t.notes === 'string' && /migration 5/.test(t.notes),
    );
    expect(m5).toHaveLength(0);
  });

  it('does not re-run on subsequent boots once schemaVersion advances to 5', async () => {
    setMetaAtVersion4();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'XLE', shares: 50, buyPrice: 70, buyDate: '2024-01-01',
          assetType: 'etf', inPortfolio: true, category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    const r1 = await runMigrations();
    expect(r1.finalVersion).toBeGreaterThanOrEqual(5);

    // The runner is now at version 5. Re-run should be a no-op.
    const r2 = await runMigrations();
    expect(r2.ran).toHaveLength(0);
  });
});
