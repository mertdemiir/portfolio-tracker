import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { switchBackend, makeAdapter } from '../backendSwitch';
import { LocalStorageAdapter } from '../localStorageAdapter';
import { IndexedDbAdapter } from '../indexedDbAdapter';
import { readAppMeta } from '../../schema';

/**
 * Tests exercise the full switch pipeline against fake-indexeddb.
 *
 * We avoid global deleteDatabase between tests (it blocks on open
 * connections from earlier tests in fake-indexeddb). Instead each
 * test creates its own source adapter and relies on switchBackend's
 * internal close of the target. The shared IDB instance is cleared
 * at the start of each test via a fresh adapter + clear().
 */

beforeEach(async () => {
  localStorage.clear();
  const cleaner = new IndexedDbAdapter();
  await cleaner.init();
  await cleaner.clear();
  await cleaner.close();
  // Mock Electron API so saveManualBackup succeeds silently.
  vi.stubGlobal('window', {
    ...window,
    electronAPI: {
      exportData: vi.fn(async () => ({ success: true })),
    },
  });
  window.confirm = vi.fn(() => true) as unknown as typeof window.confirm;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('switchBackend — happy path (LS → IDB)', () => {
  it('copies every managed key to the target', async () => {
    const source = new LocalStorageAdapter();
    await source.init();
    await source.set('portfolio-holdings', [{ id: 'h1', ticker: 'AAPL' }]);
    await source.set('transactions', [{ id: 't1', type: 'buy' }]);
    await source.set('portfolio-snapshots', [
      { date: '2026-01-01', totalValue: 1000, netWorthValue: 1000 },
    ]);

    const result = await switchBackend('indexedDB', { backup: 'required', source });
    expect(result.ok).toBe(true);
    expect(result.copied).toBe(3);
    expect(result.verificationFailures).toEqual([]);

    // Verify by reading back through a fresh IDB instance
    const verify = new IndexedDbAdapter();
    await verify.init();
    expect(await verify.get('portfolio-holdings')).toEqual([{ id: 'h1', ticker: 'AAPL' }]);
    expect(await verify.get('transactions')).toEqual([{ id: 't1', type: 'buy' }]);
    await verify.close();
  });

  it('leaves the source untouched (rollback path)', async () => {
    const source = new LocalStorageAdapter();
    await source.init();
    await source.set('portfolio-holdings', [{ id: 'h1' }]);

    await switchBackend('indexedDB', { backup: 'required', source });

    expect(await source.get('portfolio-holdings')).toEqual([{ id: 'h1' }]);
  });

  it('updates app-meta.dataBackend on success', async () => {
    const source = new LocalStorageAdapter();
    await source.init();
    await source.set('portfolio-holdings', [{ id: 'h1' }]);

    expect(readAppMeta().dataBackend).toBe('localStorage');
    const result = await switchBackend('indexedDB', { backup: 'required', source });
    expect(result.ok).toBe(true);
    expect(readAppMeta().dataBackend).toBe('indexedDB');
  });
});

describe('switchBackend — round-trip', () => {
  it('LS → IDB → LS preserves all data', async () => {
    const holdings = [{ id: 'h1', ticker: 'AAPL', shares: 10 }];
    const transactions = [
      { id: 't1', ticker: 'AAPL', shares: 10, pricePerShare: 150, total: 1500 },
    ];

    // LS → IDB
    const ls = new LocalStorageAdapter();
    await ls.init();
    await ls.set('portfolio-holdings', holdings);
    await ls.set('transactions', transactions);
    const r1 = await switchBackend('indexedDB', { backup: 'required', source: ls });
    expect(r1.ok).toBe(true);

    // IDB → LS (clear LS first to simulate a fresh rollback target)
    localStorage.clear();
    const idb = new IndexedDbAdapter();
    await idb.init();
    const r2 = await switchBackend('localStorage', { backup: 'required', source: idb });
    expect(r2.ok).toBe(true);
    await idb.close();

    const backToLS = new LocalStorageAdapter();
    await backToLS.init();
    expect(await backToLS.get('portfolio-holdings')).toEqual(holdings);
    expect(await backToLS.get('transactions')).toEqual(transactions);
  });
});

describe('switchBackend — failure paths', () => {
  it('aborts gracefully when backup is rejected by the user', async () => {
    vi.stubGlobal('window', {
      ...window,
      electronAPI: {
        exportData: vi.fn(async () => ({ success: false, cancelled: true })),
      },
    });
    window.confirm = vi.fn(() => true) as unknown as typeof window.confirm;

    const source = new LocalStorageAdapter();
    await source.init();
    await source.set('portfolio-holdings', [{ id: 'h1' }]);

    const result = await switchBackend('indexedDB', { backup: 'required', source });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/backup was not saved/i);
    expect(readAppMeta().dataBackend).toBe('localStorage');
  });

  it('does not flip the flag if copy throws mid-flight', async () => {
    const source = new LocalStorageAdapter();
    await source.init();
    await source.set('portfolio-holdings', [{ id: 'h1' }]);

    // Force the source.get to throw on second key
    const origGet = source.get.bind(source);
    let calls = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    source.get = (async (key: string) => {
      calls++;
      if (calls > 1) throw new Error('simulated read failure');
      return origGet(key);
    }) as any;

    const result = await switchBackend('indexedDB', { backup: 'required', source });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/simulated read failure/i);
    expect(readAppMeta().dataBackend).toBe('localStorage');
  });
});

describe('makeAdapter', () => {
  it('returns a LocalStorageAdapter for "localStorage"', () => {
    expect(makeAdapter('localStorage')).toBeInstanceOf(LocalStorageAdapter);
  });
  it('returns an IndexedDbAdapter for "indexedDB"', () => {
    expect(makeAdapter('indexedDB')).toBeInstanceOf(IndexedDbAdapter);
  });
});
