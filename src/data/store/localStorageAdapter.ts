import type { StorageAdapter } from './types';
import { MANAGED_STORE_KEYS } from './types';

/**
 * localStorage-backed adapter.
 *
 * Preserves the existing app behavior — every managed key lives in
 * `window.localStorage`, serialized as JSON. All methods return resolved
 * promises so the API is uniform with the IndexedDB adapter.
 *
 * Failure modes:
 *   - localStorage unavailable (private mode / disabled): reads return
 *     null, writes silently fail. Callers should not assume persistence.
 *   - Quota exceeded: `set` throws the browser's QuotaExceededError so
 *     the caller can surface it to the user.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'localStorage' as const;

  async init(): Promise<void> {
    // localStorage is ready synchronously.
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    // Let QuotaExceededError propagate — callers may want to surface it.
    localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore — removeItem rarely fails but is best-effort either way.
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const key of MANAGED_STORE_KEYS) {
      const value = await this.get(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }

  async listKeys(): Promise<string[]> {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (MANAGED_STORE_KEYS as readonly string[]).includes(k)) {
          keys.push(k);
        }
      }
    } catch {
      // ignore
    }
    return keys;
  }

  async clear(): Promise<void> {
    // Only clear managed keys; never touch settings, app-meta, or backups.
    for (const key of MANAGED_STORE_KEYS) {
      await this.remove(key);
    }
  }
}
