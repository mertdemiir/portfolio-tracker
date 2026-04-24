/**
 * Vitest global setup:
 *  - Polyfills localStorage (jsdom's Storage is missing `clear()` in
 *    current versions).
 *  - Polyfills IndexedDB via fake-indexeddb so the IndexedDbAdapter can
 *    be exercised in unit tests without a real browser.
 *  - Registers @testing-library/jest-dom matchers globally.
 *  - Resets localStorage and the store-cache singleton before every
 *    test so state cannot leak between them.
 */

import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { resetCacheForTests } from './data/store/hydration';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

// Replace jsdom's broken Storage implementation with a simple compliant one
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

// Reset persistent state between every test. Without this, the managed-store
// cache (a module-level singleton) leaks values across tests that seed
// localStorage but don't explicitly reset the cache.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetCacheForTests();
});
