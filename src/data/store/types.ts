/**
 * Storage adapter interface.
 *
 * Provides a uniform async read/write API over localStorage and IndexedDB.
 * The app's persistent state lives in localStorage today; future phases
 * will migrate the "big store" keys (holdings, transactions, snapshots,
 * priceCache, benchmark data, watchlist) to IndexedDB for:
 *   - Capacity (localStorage caps at ~5–10 MB)
 *   - Write cost (localStorage writes are sync and block the main thread)
 *
 * Small settings (theme, accentColor, baseCurrency, apiKey, etc.) stay
 * in localStorage via the existing useLocalStorage hook — they read
 * synchronously on mount and there's no upside to going async for a
 * few dozen bytes.
 *
 * All methods are async because IndexedDB is inherently async. The
 * hydration layer (see hydration.ts) pre-reads every managed key at app
 * boot into a sync in-memory cache, so React hooks can still read
 * synchronously after mount.
 */

export interface StorageAdapter {
  /** Resolves when the backend is ready for reads/writes. */
  init(): Promise<void>;

  /** Reads a JSON-encoded value by key. Returns null if missing. */
  get<T = unknown>(key: string): Promise<T | null>;

  /** Writes a JSON-encoded value under the given key. */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /** Removes a single key. */
  remove(key: string): Promise<void>;

  /** Reads every key in this adapter. Used for hydration + migrations. */
  getAll(): Promise<Record<string, unknown>>;

  /** Lists all stored keys. Cheap on both backends. */
  listKeys(): Promise<string[]>;

  /** Clears every key managed by this adapter. Callers should back up first. */
  clear(): Promise<void>;

  /** Human-readable backend name for diagnostics / logs. */
  readonly name: 'localStorage' | 'indexedDB';
}

/**
 * The set of keys this store manages. Anything not in this list stays in
 * raw localStorage via useLocalStorage — it's treated as "settings" and
 * is outside the adapter's scope.
 *
 * Order is deliberate: biggest / most write-heavy first so migrations can
 * surface errors on the tables that matter most before finishing.
 */
export const MANAGED_STORE_KEYS = [
  'portfolio-holdings',
  'portfolio-snapshots',
  'transactions',
  // Unified price cache as of schema v2 — shared between portfolio and
  // watchlist. Pre-v2 installs had a separate `watchlist-price-cache`
  // key; migration 2 merges it in and removes the old key.
  'price-cache',
  'watchlist-items',
  'benchmark-data-spx',
  'benchmark-data-btc',
  'benchmark-data-gold',
  'timeline-annotations',
  'liabilities',
  'portfolios',
  'custom-categories',
  'holding-order',
  'target-allocations',
  'nw-milestones',
] as const;

export type ManagedStoreKey = (typeof MANAGED_STORE_KEYS)[number];

export function isManagedStoreKey(key: string): key is ManagedStoreKey {
  return (MANAGED_STORE_KEYS as readonly string[]).includes(key);
}
