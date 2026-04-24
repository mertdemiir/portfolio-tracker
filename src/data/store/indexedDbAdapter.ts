import { openDB, type IDBPDatabase } from 'idb';
import type { StorageAdapter } from './types';

/**
 * IndexedDB-backed adapter.
 *
 * Uses a single object store named `kv` keyed by the same string keys the
 * localStorage adapter uses, so migrating between them is a simple copy.
 * Values are stored as the JS objects directly — structured-clone-able
 * types pass through without JSON.stringify, which is both faster and
 * preserves things like Dates if we ever need them.
 *
 * Failure modes:
 *   - IDB disabled (private mode on some browsers): `init` rejects and
 *     the app should fall back to the localStorage adapter.
 *   - Blocked upgrade (another tab holds an older version open): we log
 *     and wait; in practice `idb`'s openDB handles this gracefully.
 *
 * Future phases may add secondary object stores (e.g. a time-series
 * snapshot table) by bumping the version and wiring an upgrade fn.
 */

const DB_NAME = 'portfolio-tracker';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

export class IndexedDbAdapter implements StorageAdapter {
  readonly name = 'indexedDB' as const;

  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  private requireDb(): IDBPDatabase {
    if (!this.db) {
      throw new Error('IndexedDbAdapter used before init() completed');
    }
    return this.db;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const db = this.requireDb();
    const value = await db.get(STORE_NAME, key);
    return value === undefined ? null : (value as T);
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const db = this.requireDb();
    await db.put(STORE_NAME, value as unknown, key);
  }

  async remove(key: string): Promise<void> {
    const db = this.requireDb();
    await db.delete(STORE_NAME, key);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const db = this.requireDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keys = await store.getAllKeys();
    const values = await store.getAll();
    await tx.done;
    const out: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (typeof k === 'string') {
        out[k] = values[i];
      }
    }
    return out;
  }

  async listKeys(): Promise<string[]> {
    const db = this.requireDb();
    const keys = await db.getAllKeys(STORE_NAME);
    return keys.filter((k): k is string => typeof k === 'string');
  }

  async clear(): Promise<void> {
    const db = this.requireDb();
    await db.clear(STORE_NAME);
  }

  /**
   * Closes the underlying connection. Mainly useful in tests so that
   * `deleteDatabase` can proceed without waiting on a live connection.
   */
  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }
}
