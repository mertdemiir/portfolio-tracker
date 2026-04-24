import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { readAppMeta, writeAppMeta, APP_META_KEY } from '../schema';

/**
 * Integration test for schema migration 1: portfolioId normalization.
 *
 * Seeds localStorage at schemaVersion 0 with legacy holdings/transactions
 * that have undefined or missing portfolioId, then runs runMigrations
 * and asserts every record now has `portfolioId: 'default'`.
 */
describe('migration 1 — portfolioId normalization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion0() {
    writeAppMeta({
      schemaVersion: 0,
      lastAppVersion: '1.1.0',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.1.0',
      dataBackend: 'localStorage',
    });
  }

  it('fills in portfolioId=default on holdings that were missing it', async () => {
    setMetaAtVersion0();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', shares: 10 }, // no portfolioId
        { id: 'h2', ticker: 'TSLA', shares: 5, portfolioId: undefined },
        { id: 'h3', ticker: 'MSFT', shares: 3, portfolioId: '' },
        { id: 'h4', ticker: 'GOOG', shares: 2, portfolioId: 'custom-bucket' }, // already set
      ]),
    );

    const result = await runMigrations();
    expect(result.failed).toBeNull();
    // Runner carries through every pending migration; finalVersion is
    // the latest, not specifically 1.
    expect(result.finalVersion).toBeGreaterThanOrEqual(1);

    const after = JSON.parse(localStorage.getItem('portfolio-holdings')!);
    expect(after[0].portfolioId).toBe('default');
    expect(after[1].portfolioId).toBe('default');
    expect(after[2].portfolioId).toBe('default');
    expect(after[3].portfolioId).toBe('custom-bucket'); // preserved
  });

  it('fills in portfolioId=default on transactions that were missing it', async () => {
    setMetaAtVersion0();
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', ticker: 'AAPL', type: 'buy', shares: 10, pricePerShare: 150, total: 1500 },
        { id: 't2', ticker: 'MSFT', type: 'sell', shares: 2, pricePerShare: 200, total: 400, portfolioId: 'work-401k' },
      ]),
    );

    const result = await runMigrations();
    expect(result.failed).toBeNull();
    // Runner carries through every pending migration; finalVersion is
    // the latest, not specifically 1.
    expect(result.finalVersion).toBeGreaterThanOrEqual(1);

    const after = JSON.parse(localStorage.getItem('transactions')!);
    expect(after[0].portfolioId).toBe('default');
    expect(after[1].portfolioId).toBe('work-401k');
  });

  it('records the migration in app-meta.history with success=true', async () => {
    setMetaAtVersion0();
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1', ticker: 'AAPL', shares: 10 }]));

    await runMigrations();

    const meta = readAppMeta();
    expect(meta.schemaVersion).toBeGreaterThanOrEqual(1);
    expect(meta.history.length).toBeGreaterThan(0);
    // Look for the specific v1 migration entry (there may be others for v2+)
    const v1Record = meta.history.find((h) => h.toVersion === 1);
    expect(v1Record).toBeDefined();
    expect(v1Record?.success).toBe(true);
    expect(v1Record?.backupKey).toMatch(/^__pre_migration_0_to_1_/);
  });

  it('is idempotent: running again after completion is a no-op', async () => {
    setMetaAtVersion0();
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1', ticker: 'AAPL' }]));

    const r1 = await runMigrations();
    const versionAfter1 = readAppMeta().schemaVersion;
    const historyLen1 = readAppMeta().history.length;
    expect(r1.finalVersion).toBe(versionAfter1);

    const r2 = await runMigrations();
    expect(r2.finalVersion).toBe(versionAfter1);
    expect(r2.ran).toHaveLength(0); // nothing new to run
    expect(readAppMeta().history).toHaveLength(historyLen1); // no new entries
  });

  it('tolerates malformed holdings/transactions data without crashing', async () => {
    setMetaAtVersion0();
    localStorage.setItem('portfolio-holdings', 'not-json-at-all');
    localStorage.setItem('transactions', JSON.stringify({ not: 'an-array' }));

    const result = await runMigrations();
    // Migration 1 catches errors internally; schema still advances
    // Runner carries through every pending migration; finalVersion is
    // the latest, not specifically 1.
    expect(result.finalVersion).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBeNull();
  });

  it('writes a pre-migration backup to localStorage', async () => {
    setMetaAtVersion0();
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1' }]));

    await runMigrations();

    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('__pre_migration_0_to_1_')) backupKeys.push(k);
    }
    expect(backupKeys.length).toBeGreaterThan(0);
    const backup = JSON.parse(localStorage.getItem(backupKeys[0])!);
    expect(backup.exportedBy).toBe('pre-migration');
    expect(Array.isArray(backup.holdings)).toBe(true);
  });

  it('does not touch app-meta key on localStorage during the migration', async () => {
    setMetaAtVersion0();
    const before = localStorage.getItem(APP_META_KEY);
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1' }]));
    await runMigrations();
    // app-meta is updated (to record the migration + advance version),
    // but the key itself should not have been deleted/corrupted
    expect(localStorage.getItem(APP_META_KEY)).not.toBeNull();
    expect(localStorage.getItem(APP_META_KEY)).not.toBe(before); // updated, not destroyed
  });
});
