import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { writeAppMeta } from '../schema';

/**
 * Integration tests for schema migration 7: Phase 3 source-of-truth
 * completion. Verifies storage matches derivation; rewrites storage
 * if any drift is detected.
 */
describe('migration 7 — verify storage matches ledger', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion6() {
    writeAppMeta({
      schemaVersion: 6,
      lastAppVersion: '1.7.0',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.7.0',
      dataBackend: 'localStorage',
    });
  }

  it('is a no-op when storage already matches the ledger', async () => {
    setMetaAtVersion6();
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

    const before = localStorage.getItem('portfolio-holdings');
    await runMigrations();
    const after = localStorage.getItem('portfolio-holdings');

    expect(after).toBe(before); // no mutation when ledger == storage
  });

  it('writes derived values back when storage drifts from the ledger', async () => {
    setMetaAtVersion6();
    // Stored: 10 sh @ $150. But the ledger says 8 @ $140.
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
          shares: 8, pricePerShare: 140, total: 1120, portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();

    const after = JSON.parse(localStorage.getItem('portfolio-holdings')!);
    expect(after[0].shares).toBe(8);
    expect(after[0].buyPrice).toBe(140);
  });

  it('skips holdings with no matching ledger entries (avoids zeroing legitimate manual data)', async () => {
    setMetaAtVersion6();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'CUSTOM', shares: 5, buyPrice: 1000, buyDate: '2024-01-01',
          assetType: 'custom', inPortfolio: true, category: 'other', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    const before = localStorage.getItem('portfolio-holdings');
    await runMigrations();
    const after = localStorage.getItem('portfolio-holdings');

    expect(after).toBe(before); // no ledger to verify against, leave as-is
  });

  it('skips cash holdings', async () => {
    setMetaAtVersion6();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'c1', ticker: 'CHECKING', shares: 1000, buyPrice: 1, buyDate: '2024-01-01',
          assetType: 'cash', inPortfolio: false, category: 'cash-savings', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    const before = localStorage.getItem('portfolio-holdings');
    await runMigrations();
    const after = localStorage.getItem('portfolio-holdings');

    expect(after).toBe(before);
  });

  it('is idempotent: running twice on drifted data converges and stops mutating', async () => {
    setMetaAtVersion6();
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
          shares: 8, pricePerShare: 140, total: 1120, portfolioId: 'default', holdingId: 'h1' },
      ]),
    );

    await runMigrations();
    const after1 = localStorage.getItem('portfolio-holdings');

    // Reset version and re-run.
    const meta = JSON.parse(localStorage.getItem('app-meta')!);
    meta.schemaVersion = 6;
    localStorage.setItem('app-meta', JSON.stringify(meta));

    await runMigrations();
    const after2 = localStorage.getItem('portfolio-holdings');

    expect(after2).toBe(after1); // already converged; second run is a no-op
  });

  it('does not re-run on subsequent boots once schemaVersion advances to 7', async () => {
    setMetaAtVersion6();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', shares: 10, buyPrice: 150, buyDate: '2024-01-01',
          assetType: 'stock', inPortfolio: true, category: 'investments', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    const r1 = await runMigrations();
    expect(r1.finalVersion).toBeGreaterThanOrEqual(7);

    const r2 = await runMigrations();
    expect(r2.ran).toHaveLength(0);
  });
});
