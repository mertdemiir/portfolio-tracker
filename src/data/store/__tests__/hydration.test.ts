import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setAdapter,
  getAdapter,
  hydrateStore,
  isHydrated,
  readCached,
  writeCached,
  removeCached,
  resetCacheForTests,
} from '../hydration';
import { LocalStorageAdapter } from '../localStorageAdapter';
import type { StorageAdapter } from '../types';

describe('hydration layer', () => {
  beforeEach(() => {
    localStorage.clear();
    resetCacheForTests();
  });

  it('defaults to LocalStorageAdapter', () => {
    expect(getAdapter()).toBeInstanceOf(LocalStorageAdapter);
    expect(getAdapter().name).toBe('localStorage');
  });

  it('hydrateStore pre-populates the cache from the adapter', async () => {
    // Seed localStorage before hydration
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1' }]));
    localStorage.setItem('transactions', JSON.stringify([{ id: 't1' }]));

    expect(isHydrated()).toBe(false);
    await hydrateStore();
    expect(isHydrated()).toBe(true);

    expect(readCached('portfolio-holdings', [])).toEqual([{ id: 'h1' }]);
    expect(readCached('transactions', [])).toEqual([{ id: 't1' }]);
  });

  it('readCached returns the fallback for keys not present', async () => {
    await hydrateStore();
    expect(readCached('portfolio-holdings', [])).toEqual([]);
    expect(readCached('transactions', ['default'])).toEqual(['default']);
  });

  it('warns (once per key) when readCached is called before hydration', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    readCached('portfolio-holdings', []);
    readCached('portfolio-holdings', []); // second call → no second warning
    readCached('transactions', []); // different key → new warning
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('hydrateStore is idempotent', async () => {
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1' }]));
    await hydrateStore();
    await hydrateStore();
    expect(readCached('portfolio-holdings', [])).toEqual([{ id: 'h1' }]);
  });

  it('writeCached updates the cache synchronously and persists async', async () => {
    await hydrateStore();
    writeCached('portfolio-holdings', [{ id: 'new' }]);
    // Sync read reflects the change immediately
    expect(readCached('portfolio-holdings', [])).toEqual([{ id: 'new' }]);
    // Next tick: backing store also has it
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(localStorage.getItem('portfolio-holdings')!)).toEqual([{ id: 'new' }]);
  });

  it('removeCached clears the key sync and async', async () => {
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1' }]));
    await hydrateStore();
    removeCached('portfolio-holdings');
    expect(readCached('portfolio-holdings', [])).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(localStorage.getItem('portfolio-holdings')).toBeNull();
  });

  it('setAdapter swaps the backend when called before hydration', async () => {
    const fake: StorageAdapter = {
      name: 'indexedDB',
      init: vi.fn(async () => {}),
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      getAll: vi.fn(async () => ({ 'portfolio-holdings': [{ id: 'from-fake' }] })),
      listKeys: vi.fn(async () => []),
      clear: vi.fn(async () => {}),
    };
    setAdapter(fake);
    await hydrateStore();
    expect(fake.init).toHaveBeenCalled();
    expect(fake.getAll).toHaveBeenCalled();
    expect(readCached('portfolio-holdings', [])).toEqual([{ id: 'from-fake' }]);
  });

  it('setAdapter throws if called after hydration', async () => {
    await hydrateStore();
    const dummy: StorageAdapter = {
      name: 'indexedDB',
      init: async () => {},
      get: async () => null,
      set: async () => {},
      remove: async () => {},
      getAll: async () => ({}),
      listKeys: async () => [],
      clear: async () => {},
    };
    expect(() => setAdapter(dummy)).toThrow(/after hydrateStore/);
  });

  it('writeCached swallows adapter errors (fire-and-forget)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing: StorageAdapter = {
      name: 'localStorage',
      init: async () => {},
      get: async () => null,
      set: async () => { throw new Error('boom'); },
      remove: async () => {},
      getAll: async () => ({}),
      listKeys: async () => [],
      clear: async () => {},
    };
    setAdapter(failing);
    await hydrateStore();

    writeCached('portfolio-holdings', [{ id: 'x' }]);
    // Cache updated despite write failure
    expect(readCached('portfolio-holdings', [])).toEqual([{ id: 'x' }]);
    // Error logged
    await new Promise((r) => setTimeout(r, 10));
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
