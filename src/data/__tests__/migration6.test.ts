import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { writeAppMeta } from '../schema';
import { deriveHolding } from '../../utils/transactionLedger';

/**
 * Integration tests for schema migration 6: complete ledger reconcile
 * (both shares AND buyPrice). Closes the residual gap left by mig 5.
 */
describe('migration 6 — complete ledger reconcile (shares + buyPrice)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion5() {
    writeAppMeta({
      schemaVersion: 5,
      lastAppVersion: '1.4.5',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.4.5',
      dataBackend: 'localStorage',
    });
  }

  it('REMX-shape: shares match but buyPrice differs — adds synthetic buy+sell pair to align weighted-avg', async () => {
    // Reproduces the user's REMX state on v1.4.4: shares match, derived
    // buyPrice $96.87 vs stored $95.35.
    setMetaAtVersion5();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'REMX', name: 'Rare Earth', shares: 18.8925, buyPrice: 95.35,
          buyDate: '2024-01-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    // Real txns produce 18.8925 sh @ $96.87 weighted-avg.
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-02-01', ticker: 'REMX', name: 'Rare Earth', type: 'buy',
          shares: 18.8925, pricePerShare: 96.87, total: 1830.21,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    const r = await runMigrations();
    expect(r.failed).toBeNull();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const holding = JSON.parse(localStorage.getItem('portfolio-holdings')!)[0];

    // After migration 6, deriveHolding should agree with stored.
    const d = deriveHolding(
      { id: holding.id, ticker: holding.ticker, portfolioId: holding.portfolioId,
        assetType: holding.assetType, buyDate: holding.buyDate },
      txns,
    );
    expect(d.shares).toBeCloseTo(18.8925, 6);
    expect(d.buyPrice).toBeCloseTo(95.35, 4);
  });

  it('handles BOTH shares mismatch AND buyPrice mismatch in one pass', async () => {
    setMetaAtVersion5();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'XLE', shares: 100, buyPrice: 50,
          buyDate: '2024-01-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    // Real txns produce 80 sh @ $60 → both shares (gap +20) and price ($60→$50) need fixing.
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-02-01', ticker: 'XLE', type: 'buy',
          shares: 80, pricePerShare: 60, total: 4800,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const holding = JSON.parse(localStorage.getItem('portfolio-holdings')!)[0];
    const d = deriveHolding(
      { id: holding.id, ticker: holding.ticker, portfolioId: holding.portfolioId,
        assetType: holding.assetType, buyDate: holding.buyDate },
      txns,
    );
    expect(d.shares).toBeCloseTo(100, 6);
    expect(d.buyPrice).toBeCloseTo(50, 4);
  });

  it('is a no-op when ledger and storage already agree on both shares + buyPrice', async () => {
    setMetaAtVersion5();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', shares: 10, buyPrice: 150,
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
    const synthetics = txns.filter((t: { synthetic?: boolean }) => t.synthetic);
    expect(synthetics).toHaveLength(0);
    expect(txns).toHaveLength(1);
  });

  it('is idempotent: re-running on already-reconciled data gives the same end state', async () => {
    setMetaAtVersion5();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'REMX', shares: 18.8925, buyPrice: 95.35,
          buyDate: '2024-01-01', assetType: 'etf', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-02-01', ticker: 'REMX', type: 'buy',
          shares: 18.8925, pricePerShare: 96.87, total: 1830.21,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();
    const after1 = JSON.parse(localStorage.getItem('transactions')!);

    // Manually reset to v5 so the runner re-runs migration 6.
    const meta = JSON.parse(localStorage.getItem('app-meta')!);
    meta.schemaVersion = 5;
    localStorage.setItem('app-meta', JSON.stringify(meta));

    await runMigrations();
    const after2 = JSON.parse(localStorage.getItem('transactions')!);

    // Same shape: 1 real + 2 synthetics (price-fix pair). Numbers match.
    expect(after2.filter((t: { synthetic?: boolean }) => t.synthetic).length).toBe(
      after1.filter((t: { synthetic?: boolean }) => t.synthetic).length,
    );
  });

  it('the reset rule never fires between the synthetic buy and synthetic sell', async () => {
    // Critical safety check: the synthetic pair must not accidentally
    // trigger a position-closed reset.
    setMetaAtVersion5();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'X', shares: 5, buyPrice: 100,
          buyDate: '2024-01-01', assetType: 'stock', inPortfolio: true,
          category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        // Real txn: 5 sh @ $200 (so weighted-avg is way off from stored $100).
        { id: 't1', date: '2024-02-01', ticker: 'X', type: 'buy',
          shares: 5, pricePerShare: 200, total: 1000,
          portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const holding = JSON.parse(localStorage.getItem('portfolio-holdings')!)[0];
    const d = deriveHolding(
      { id: holding.id, ticker: holding.ticker, portfolioId: holding.portfolioId,
        assetType: holding.assetType, buyDate: holding.buyDate },
      txns,
    );
    expect(d.shares).toBeCloseTo(5, 6);
    expect(d.buyPrice).toBeCloseTo(100, 4);
  });

  it('skips cash holdings', async () => {
    setMetaAtVersion5();
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
    const m6 = txns.filter(
      (t: { notes?: string }) => typeof t.notes === 'string' && /migration 6/.test(t.notes),
    );
    expect(m6).toHaveLength(0);
  });

  it('does not re-run on subsequent boots once schemaVersion advances to 6', async () => {
    setMetaAtVersion5();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'XLE', shares: 50, buyPrice: 70, buyDate: '2024-01-01',
          assetType: 'etf', inPortfolio: true, category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    const r1 = await runMigrations();
    expect(r1.finalVersion).toBeGreaterThanOrEqual(6);

    const r2 = await runMigrations();
    expect(r2.ran).toHaveLength(0);
  });
});
