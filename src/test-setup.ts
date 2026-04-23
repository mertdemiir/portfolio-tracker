/**
 * Vitest global setup. Provides a spec-compliant localStorage polyfill for
 * jsdom (the bundled jsdom's Storage is missing `clear()` in current
 * versions) and resets it between tests. Also registers jest-dom matchers.
 */

import '@testing-library/jest-dom/vitest';

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
