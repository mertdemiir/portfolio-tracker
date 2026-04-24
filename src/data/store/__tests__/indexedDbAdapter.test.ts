import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDbAdapter } from '../indexedDbAdapter';

/**
 * Tests run against fake-indexeddb, which implements the IDB spec in
 * pure JS. The behavior we care about is identical to real browsers:
 *  - Async reads/writes via promises
 *  - Structured clone for values
 *  - Per-database isolation
 */

async function deleteTestDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('portfolio-tracker');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

describe('IndexedDbAdapter', () => {
  let adapter: IndexedDbAdapter;

  beforeEach(async () => {
    await deleteTestDb();
    adapter = new IndexedDbAdapter();
    await adapter.init();
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('has the correct name for diagnostics', () => {
    expect(adapter.name).toBe('indexedDB');
  });

  it('init is idempotent', async () => {
    await adapter.init();
    await adapter.init();
    // Still usable
    await adapter.set('x', 1);
    expect(await adapter.get('x')).toBe(1);
  });

  it('throws if used before init', async () => {
    const unitialized = new IndexedDbAdapter();
    await expect(unitialized.get('x')).rejects.toThrow(/used before init/);
  });

  it('get returns null when a key is missing', async () => {
    expect(await adapter.get('portfolio-holdings')).toBeNull();
  });

  it('set + get round-trip arbitrary JSON-serializable values', async () => {
    const holdings = [{ id: 'h1', ticker: 'AAPL', shares: 10 }];
    await adapter.set('portfolio-holdings', holdings);
    expect(await adapter.get('portfolio-holdings')).toEqual(holdings);
  });

  it('preserves structured-clone types like nested Sets and Dates', async () => {
    // Construct date via numeric args to avoid the UTC shift trap
    const when = new Date(2026, 5, 15); // June 15 2026 local
    const value = {
      when,
      tags: new Set(['a', 'b']),
    };
    await adapter.set('weird', value);
    const out = await adapter.get<typeof value>('weird');
    expect(out?.when).toBeInstanceOf(Date);
    expect(out?.when.getTime()).toBe(when.getTime());
    expect(out?.tags).toBeInstanceOf(Set);
    expect(out?.tags.has('a')).toBe(true);
  });

  it('remove clears the key', async () => {
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    await adapter.remove('portfolio-holdings');
    expect(await adapter.get('portfolio-holdings')).toBeNull();
  });

  it('getAll returns every key that has been set', async () => {
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    await adapter.set('transactions', [{ id: 't1' }]);
    const all = await adapter.getAll();
    expect(all).toEqual({
      'portfolio-holdings': [{ id: 'h1' }],
      transactions: [{ id: 't1' }],
    });
  });

  it('listKeys lists only keys with stored values', async () => {
    await adapter.set('portfolio-holdings', []);
    await adapter.set('transactions', []);
    const keys = await adapter.listKeys();
    expect(keys.sort()).toEqual(['portfolio-holdings', 'transactions']);
  });

  it('clear removes every entry', async () => {
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    await adapter.set('transactions', [{ id: 't1' }]);
    await adapter.clear();
    expect(await adapter.listKeys()).toEqual([]);
  });

  it('multiple sets to the same key keep the latest value', async () => {
    await adapter.set('x', 1);
    await adapter.set('x', 2);
    await adapter.set('x', 3);
    expect(await adapter.get('x')).toBe(3);
  });
});
