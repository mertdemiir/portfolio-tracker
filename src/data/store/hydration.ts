/**
 * App-boot hydration layer.
 *
 * Bridges the async StorageAdapter API with the app's sync-everywhere
 * React hooks. The pattern:
 *
 *   1. Before `createRoot().render(<App />)` in main.tsx, we call
 *      `hydrateStore()` which awaits the adapter's init + getAll, then
 *      populates an in-memory Map.
 *   2. During render, hooks read from the Map synchronously via
 *      `readCached` — no Promises, no loading states.
 *   3. When a hook writes via `writeCached`, we update the Map
 *      synchronously AND enqueue an async write to the adapter. The
 *      in-memory state is always the source of truth during the session.
 *
 * Writes are fire-and-forget for simplicity. If a write fails (e.g. IDB
 * transaction aborts), we log to the console — the next successful write
 * on the same key will overwrite it. For higher-stakes keys we can add a
 * retry queue in a future phase.
 *
 * NOTE: This module is deliberately side-effect-heavy (singleton state)
 * because it mirrors localStorage's own singleton API. Tests should call
 * `resetCache()` in a beforeEach.
 */

import type { StorageAdapter } from './types';
import { LocalStorageAdapter } from './localStorageAdapter';

let activeAdapter: StorageAdapter = new LocalStorageAdapter();
const cache = new Map<string, unknown>();
let hydrated = false;

/**
 * Overrides the adapter. Must be called BEFORE `hydrateStore`. Normally
 * the app's main.tsx picks localStorage by default and the user (via a
 * future feature flag in Settings) opts into IndexedDB.
 */
export function setAdapter(adapter: StorageAdapter): void {
  if (hydrated) {
    // Changing adapters after hydration would stale-ify the cache; disallow.
    throw new Error('setAdapter called after hydrateStore — change adapter before hydration');
  }
  activeAdapter = adapter;
}

export function getAdapter(): StorageAdapter {
  return activeAdapter;
}

/**
 * Initializes the adapter and pre-loads every managed key into memory.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function hydrateStore(): Promise<void> {
  if (hydrated) return;
  await activeAdapter.init();
  const all = await activeAdapter.getAll();
  for (const [key, value] of Object.entries(all)) {
    cache.set(key, value);
  }
  hydrated = true;
}

/** Returns true once `hydrateStore` has resolved at least once. */
export function isHydrated(): boolean {
  return hydrated;
}

/**
 * Synchronous read from the in-memory cache. Returns the fallback when
 * the key is missing. Safe to call in any React lifecycle.
 *
 * Warns (once per key) if called before hydration — that's a bug in
 * the caller; they should be reading from the cache we populated at
 * boot, not racing the initial load.
 */
const warnedKeys = new Set<string>();
export function readCached<T>(key: string, fallback: T): T {
  if (!hydrated && !warnedKeys.has(key)) {
    warnedKeys.add(key);
    // eslint-disable-next-line no-console
    console.warn(`readCached("${key}") called before hydrateStore resolved. This is a bug.`);
  }
  if (!cache.has(key)) return fallback;
  return cache.get(key) as T;
}

/**
 * Synchronously updates the cache and asynchronously persists to the
 * adapter. The write is fire-and-forget; errors are logged but do not
 * interrupt the caller.
 */
export function writeCached<T>(key: string, value: T): void {
  cache.set(key, value);
  activeAdapter.set(key, value).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`Failed to persist "${key}" to ${activeAdapter.name}:`, err);
  });
}

/**
 * Synchronously removes from the cache and asynchronously removes from
 * the adapter.
 */
export function removeCached(key: string): void {
  cache.delete(key);
  activeAdapter.remove(key).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`Failed to remove "${key}" from ${activeAdapter.name}:`, err);
  });
}

/**
 * Test-only: clears the cache and rebinds to a fresh LocalStorage adapter.
 * Leaves the `hydrated` flag set to true with an empty cache so tests
 * that read managed keys via hooks don't trip the pre-hydration warning.
 * Tests that want to simulate a hydration-from-storage cycle can call
 * resetCacheForTests({ hydrated: false }) and then await hydrateStore().
 */
export function resetCacheForTests(opts: { hydrated?: boolean } = {}): void {
  cache.clear();
  warnedKeys.clear();
  hydrated = opts.hydrated ?? true;
  activeAdapter = new LocalStorageAdapter();
}
