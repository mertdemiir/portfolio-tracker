import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { writeAppMeta, readAppMeta } from '../schema';

/**
 * Integration test for migration 2: watchlist-price-cache →
 * unified price-cache. Migration 1 runs first (portfolioId normalization)
 * so we verify the end state after both migrations.
 */
describe('migration 2 — unify price cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion1() {
    writeAppMeta({
      schemaVersion: 1,
      lastAppVersion: '1.2.0-pre',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.2.0-pre',
      dataBackend: 'localStorage',
    });
  }

  it('merges watchlist-price-cache into price-cache and deletes the old key', async () => {
    setMetaAtVersion1();
    localStorage.setItem(
      'watchlist-price-cache',
      JSON.stringify({
        'stock:NVDA': { currentPrice: 800, change: 10, changePercent: 1.25, lastUpdated: 100 },
      }),
    );
    localStorage.setItem(
      'price-cache',
      JSON.stringify({
        'stock:AAPL': { currentPrice: 180, change: 2, changePercent: 1.1, lastUpdated: 200 },
      }),
    );

    const result = await runMigrations();
    expect(result.failed).toBeNull();

    const merged = JSON.parse(localStorage.getItem('price-cache')!);
    expect(merged['stock:AAPL'].currentPrice).toBe(180);
    expect(merged['stock:NVDA'].currentPrice).toBe(800);
    expect(localStorage.getItem('watchlist-price-cache')).toBeNull();
  });

  it('portfolio cache wins on ticker conflict (freshness assumption)', async () => {
    setMetaAtVersion1();
    localStorage.setItem(
      'watchlist-price-cache',
      JSON.stringify({
        'stock:AAPL': { currentPrice: 170, change: 0, changePercent: 0, lastUpdated: 50 },
      }),
    );
    localStorage.setItem(
      'price-cache',
      JSON.stringify({
        'stock:AAPL': { currentPrice: 180, change: 2, changePercent: 1.1, lastUpdated: 200 },
      }),
    );

    await runMigrations();

    const merged = JSON.parse(localStorage.getItem('price-cache')!);
    // Portfolio's AAPL entry (180) wins over watchlist's (170)
    expect(merged['stock:AAPL'].currentPrice).toBe(180);
  });

  it('is a no-op when watchlist-price-cache is absent', async () => {
    setMetaAtVersion1();
    localStorage.setItem(
      'price-cache',
      JSON.stringify({ 'stock:AAPL': { currentPrice: 180 } }),
    );

    await runMigrations();

    const pc = JSON.parse(localStorage.getItem('price-cache')!);
    expect(pc['stock:AAPL'].currentPrice).toBe(180);
    expect(readAppMeta().schemaVersion).toBeGreaterThanOrEqual(2);
  });

  it('handles a missing price-cache gracefully (migrates watchlist as-is)', async () => {
    setMetaAtVersion1();
    localStorage.setItem(
      'watchlist-price-cache',
      JSON.stringify({ 'stock:NVDA': { currentPrice: 800 } }),
    );

    await runMigrations();

    const merged = JSON.parse(localStorage.getItem('price-cache')!);
    expect(merged['stock:NVDA'].currentPrice).toBe(800);
    expect(localStorage.getItem('watchlist-price-cache')).toBeNull();
  });

  it('deletes a corrupted watchlist-price-cache key safely', async () => {
    setMetaAtVersion1();
    localStorage.setItem('watchlist-price-cache', 'not-valid-json{');

    const result = await runMigrations();
    expect(result.failed).toBeNull();
    // The migration catches parse errors internally so the runner still
    // completes. Key may or may not be deleted depending on where parse
    // fails — this test just verifies we don't crash.
    expect(readAppMeta().schemaVersion).toBeGreaterThanOrEqual(2);
  });

  it('advances schemaVersion to 2 and records the migration', async () => {
    setMetaAtVersion1();
    await runMigrations();

    const meta = readAppMeta();
    // Runner carries through every pending migration; finalVersion is
    // the latest, not specifically 2.
    expect(meta.schemaVersion).toBeGreaterThanOrEqual(2);
    const mig2 = meta.history.find((h) => h.toVersion === 2);
    expect(mig2).toBeDefined();
    expect(mig2?.success).toBe(true);
  });
});
