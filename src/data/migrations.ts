/**
 * Migration runner.
 *
 * Each migration is a function that takes no args and advances the stored
 * schema by one version. Migrations MUST be idempotent: running them twice
 * produces the same result as running them once. Before running any
 * migration, the runner writes a full backup of localStorage to
 * `__pre_migration_<fromVersion>_to_<toVersion>_<timestamp>` so we can roll
 * back manually if something goes wrong.
 *
 * Registering a new migration:
 *   1. Bump CURRENT_SCHEMA_VERSION in schema.ts.
 *   2. Add an entry to the MIGRATIONS array below with the new version as key.
 *   3. Write the migration function — keep it idempotent and small.
 *   4. Add a unit test.
 */

import {
  APP_META_KEY,
  CURRENT_SCHEMA_VERSION,
  readAppMeta,
  updateAppMeta,
  type MigrationRecord,
} from './schema';
import { gatherBackupData, serializeBackup } from './backup';

/** A migration function advances the schema by exactly one version. */
export type Migration = () => void | Promise<void>;

/**
 * Registered migrations, keyed by the version they produce.
 * E.g. MIGRATIONS[1] advances the schema from version 0 to version 1.
 */
const MIGRATIONS: Record<number, Migration> = {
  /**
   * v0 → v1: Normalize portfolioId.
   *
   * Every Holding and Transaction previously allowed portfolioId to be
   * undefined, with `|| DEFAULT_PORTFOLIO_ID` fallbacks smeared across
   * hooks, context, and modals. This migration fills in the default so
   * the type can be tightened to `portfolioId: string` (non-optional)
   * post-migration.
   *
   * Idempotent: re-running it on already-normalized data is a no-op.
   * Touches only the portfolioId field; no other data is modified.
   */
  1: () => {
    const DEFAULT_PORTFOLIO_ID = 'default';

    // Holdings
    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const holdings = JSON.parse(raw);
        if (Array.isArray(holdings)) {
          let changed = false;
          for (const h of holdings) {
            if (h && typeof h === 'object' && (h.portfolioId === undefined || h.portfolioId === null || h.portfolioId === '')) {
              h.portfolioId = DEFAULT_PORTFOLIO_ID;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem('portfolio-holdings', JSON.stringify(holdings));
          }
        }
      }
    } catch {
      // Non-fatal: malformed data gets left alone. The app's own defensive
      // reads handle whatever shape it's in.
    }

    // Transactions
    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const txns = JSON.parse(raw);
        if (Array.isArray(txns)) {
          let changed = false;
          for (const t of txns) {
            if (t && typeof t === 'object' && (t.portfolioId === undefined || t.portfolioId === null || t.portfolioId === '')) {
              t.portfolioId = DEFAULT_PORTFOLIO_ID;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem('transactions', JSON.stringify(txns));
          }
        }
      }
    } catch {
      // Non-fatal
    }
  },

  /**
   * v2 → v3: Transactions become first-class.
   *
   * Two responsibilities:
   *   (a) For every Holding that has no buy Transaction in the same
   *       (ticker, portfolioId) scope, synthesize one using the holding's
   *       current buyPrice/shares/buyDate. Mark it `synthetic: true`.
   *       This establishes 1:1 parity so a future release can make the
   *       ledger authoritative without losing positions.
   *   (b) Backfill `holdingId` on every existing Transaction where
   *       exactly one holding matches on (ticker, portfolioId). Ambiguous
   *       matches are left as-is — the app's ticker-match fallback still
   *       works for them.
   *
   * Idempotent: the synthetic backfill skips holdings that already have
   * any buy Transaction in scope (including a previously-inserted
   * synthetic one), so re-running the migration is a no-op. The holdingId
   * backfill only writes when the field is currently absent.
   *
   * Non-fatal: malformed data gets skipped rather than thrown. Any
   * throw here would block the migration runner and leave the user on v2.
   */
  3: () => {
    // Tiny UUID generator (RFC4122 v4-ish, crypto-backed when available).
    const makeId = (): string => {
      const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      // Fallback: timestamp + random (sufficient — we only need local uniqueness).
      return `syn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    type RawHolding = {
      id: string;
      ticker?: unknown;
      name?: unknown;
      shares?: unknown;
      buyPrice?: unknown;
      buyDate?: unknown;
      assetType?: unknown;
      category?: unknown;
      currency?: unknown;
      buyFxRate?: unknown;
      portfolioId?: unknown;
    };

    type RawTxn = {
      id?: string;
      ticker?: unknown;
      type?: unknown;
      portfolioId?: unknown;
      holdingId?: unknown;
      synthetic?: unknown;
    };

    let holdings: RawHolding[] = [];
    let txns: (RawTxn & Record<string, unknown>)[] = [];

    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) holdings = parsed;
      }
    } catch {
      // malformed — leave alone
      return;
    }

    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {
      // malformed — leave alone
      return;
    }

    // ── (a) Backfill synthetic buys ─────────────────────────────────
    // Index existing buys by (ticker upper, portfolioId).
    const buyIndex = new Map<string, RawTxn[]>();
    const keyFor = (ticker: unknown, portfolioId: unknown): string => {
      const t = typeof ticker === 'string' ? ticker.toUpperCase() : '';
      const p = typeof portfolioId === 'string' ? portfolioId : 'default';
      return `${t}::${p}`;
    };

    for (const t of txns) {
      if (t && t.type === 'buy') {
        const k = keyFor(t.ticker, t.portfolioId);
        const list = buyIndex.get(k) ?? [];
        list.push(t);
        buyIndex.set(k, list);
      }
    }

    let addedSynthetic = 0;
    for (const h of holdings) {
      if (!h || typeof h !== 'object' || typeof h.id !== 'string') continue;
      if (typeof h.ticker !== 'string') continue;

      const k = keyFor(h.ticker, h.portfolioId);
      if (buyIndex.has(k)) continue; // already has a buy — skip

      const shares = typeof h.shares === 'number' ? h.shares : 0;
      const buyPrice = typeof h.buyPrice === 'number' ? h.buyPrice : 0;
      const buyDate = typeof h.buyDate === 'string' && h.buyDate
        ? h.buyDate
        : new Date().toISOString().slice(0, 10);
      const portfolioId = typeof h.portfolioId === 'string' && h.portfolioId
        ? h.portfolioId
        : 'default';

      const synthetic: Record<string, unknown> = {
        id: makeId(),
        date: buyDate,
        ticker: h.ticker,
        name: typeof h.name === 'string' ? h.name : h.ticker,
        type: 'buy',
        shares,
        pricePerShare: buyPrice,
        total: shares * buyPrice,
        portfolioId,
        holdingId: h.id,
        synthetic: true,
      };
      if (typeof h.assetType === 'string') synthetic.assetType = h.assetType;
      if (typeof h.category === 'string') synthetic.category = h.category;
      if (typeof h.currency === 'string') synthetic.currency = h.currency;
      if (typeof h.buyFxRate === 'number') synthetic.buyFxRate = h.buyFxRate;

      txns.push(synthetic);
      // Update the index so duplicate holdings in the same bucket don't
      // each get their own synthetic buy — the first one wins.
      buyIndex.set(k, [synthetic as RawTxn]);
      addedSynthetic++;
    }

    // ── (b) Backfill holdingId on existing Transactions ────────────
    // Index holdings by (ticker upper, portfolioId). If >1 holding
    // shares the key we refuse to backfill that bucket (ambiguous).
    const holdingIndex = new Map<string, RawHolding[]>();
    for (const h of holdings) {
      if (!h || typeof h.id !== 'string' || typeof h.ticker !== 'string') continue;
      const k = keyFor(h.ticker, h.portfolioId);
      const list = holdingIndex.get(k) ?? [];
      list.push(h);
      holdingIndex.set(k, list);
    }

    let addedHoldingId = 0;
    for (const t of txns) {
      if (!t || typeof t !== 'object') continue;
      if (typeof t.holdingId === 'string' && t.holdingId) continue; // already backfilled
      const k = keyFor(t.ticker, t.portfolioId);
      const matches = holdingIndex.get(k);
      if (!matches || matches.length !== 1) continue; // 0 or ambiguous
      t.holdingId = matches[0].id;
      addedHoldingId++;
    }

    // Only write back if something actually changed.
    if (addedSynthetic > 0 || addedHoldingId > 0) {
      try {
        localStorage.setItem('transactions', JSON.stringify(txns));
      } catch {
        // Storage full or unavailable — surface via throw so the migration
        // runner records a failure rather than silently advancing.
        throw new Error('v3: failed to write transactions back to localStorage');
      }
    }
  },

  /**
   * v1 → v2: Unify watchlist-price-cache into price-cache.
   *
   * Before: the watchlist maintained its own separate price cache at
   * localStorage['watchlist-price-cache']. If the same ticker was in
   * both portfolio and watchlist, we'd fetch the price twice.
   *
   * After: the watchlist shares the portfolio's `price-cache`. This
   * migration copies every entry from watchlist-price-cache into
   * price-cache (portfolio's cache wins on conflict because its data
   * is typically fresher — portfolio holdings drive the 5-min refresh
   * loop), then deletes the watchlist cache key.
   *
   * Idempotent: if watchlist-price-cache is missing or empty, it's a
   * no-op. Running twice after migration leaves the unified cache
   * unchanged (second run finds no watchlist key to merge).
   */
  2: () => {
    try {
      const rawWatchlist = localStorage.getItem('watchlist-price-cache');
      if (!rawWatchlist) return;
      const watchlistCache = JSON.parse(rawWatchlist);
      if (!watchlistCache || typeof watchlistCache !== 'object') {
        // Corrupted — just delete the key.
        localStorage.removeItem('watchlist-price-cache');
        return;
      }

      const rawPortfolio = localStorage.getItem('price-cache');
      const portfolioCache = rawPortfolio ? JSON.parse(rawPortfolio) || {} : {};

      // Portfolio wins on conflict — its prices are driven by the 5-min
      // refresh loop and tend to be fresher.
      const merged: Record<string, unknown> = { ...watchlistCache, ...portfolioCache };

      localStorage.setItem('price-cache', JSON.stringify(merged));
      localStorage.removeItem('watchlist-price-cache');
    } catch {
      // Non-fatal
    }
  },
};

/**
 * Maximum number of pre-migration backups to retain in localStorage.
 * Oldest are purged when this limit is exceeded.
 */
const MAX_BACKUPS_IN_LOCALSTORAGE = 3;

const BACKUP_KEY_PREFIX = '__pre_migration_';

/**
 * Writes a pre-migration backup to localStorage. Returns the key.
 * If localStorage is full, older backups are purged to make room.
 */
function writePreMigrationBackup(fromVersion: number, toVersion: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${BACKUP_KEY_PREFIX}${fromVersion}_to_${toVersion}_${timestamp}`;
  const payload = serializeBackup(gatherBackupData('pre-migration'));

  // Trim older backups to keep total count under the limit
  purgeOldBackups(MAX_BACKUPS_IN_LOCALSTORAGE - 1);

  try {
    localStorage.setItem(key, payload);
  } catch (err) {
    // Storage full. Try aggressively purging and retrying.
    purgeOldBackups(0);
    try {
      localStorage.setItem(key, payload);
    } catch {
      // If it still fails, throw — we do not proceed with migration if we
      // can't record a rollback point.
      throw new Error(
        `Failed to write pre-migration backup: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return key;
}

/**
 * Maximum age (days) for a pre-migration backup before it's pruned regardless
 * of count. Together with MAX_BACKUPS_IN_LOCALSTORAGE, this caps both the
 * count and the age of retained rollback points.
 */
const MAX_BACKUP_AGE_DAYS = 30;

function purgeOldBackups(keepCount: number): void {
  try {
    const now = Date.now();
    const ageCutoffMs = MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BACKUP_KEY_PREFIX)) keys.push(k);
    }
    // Sort oldest-first (timestamp is embedded so lexical sort works).
    keys.sort();

    // First pass — drop any backup older than MAX_BACKUP_AGE_DAYS.
    // The timestamp is the trailing component of the key after the last
    // underscore-prefixed colon-replaced ISO date. Parse it back.
    const ageDropped = new Set<string>();
    for (const k of keys) {
      const tsPart = k.replace(`${BACKUP_KEY_PREFIX}`, '').split('_').slice(2).join('_');
      // tsPart looks like 2026-04-25T00-00-00-000Z (colons + dots replaced
      // with dashes during writePreMigrationBackup). Reverse it so Date can
      // parse: keep the date portion and put the time back together.
      const restored = tsPart.replace(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
        '$1T$2:$3:$4.$5Z',
      );
      const ts = Date.parse(restored);
      if (!Number.isNaN(ts) && now - ts > ageCutoffMs) {
        try {
          localStorage.removeItem(k);
          ageDropped.add(k);
        } catch {
          /* best effort */
        }
      }
    }
    const remaining = keys.filter((k) => !ageDropped.has(k));

    // Second pass — apply the count cap on the remainder.
    const toRemove = remaining.slice(0, Math.max(0, remaining.length - keepCount));
    for (const k of toRemove) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* best effort */
      }
    }
  } catch {
    // best effort
  }
}

/**
 * Runs all pending migrations from the current stored version up to
 * CURRENT_SCHEMA_VERSION. Returns a summary of what ran.
 *
 * Behavior on failure:
 *   - The failing migration is recorded in history with `success: false`.
 *   - Subsequent migrations are NOT attempted.
 *   - The schemaVersion in app-meta is NOT advanced past the failed migration.
 *   - The caller is expected to surface this to the user (e.g. via the
 *     error boundary or a migration error screen) and offer rollback.
 */
export async function runMigrations(): Promise<{
  ran: MigrationRecord[];
  failed: MigrationRecord | null;
  finalVersion: number;
}> {
  const meta = readAppMeta();
  const ran: MigrationRecord[] = [];

  // First-run initialization: if the app-meta key doesn't exist yet, write it
  // with the current version. We assume any existing data on first boot of
  // this code is already compatible with CURRENT_SCHEMA_VERSION (since the
  // previous app had no schema versioning). Once the user has booted once,
  // future bumps will run migrations normally.
  if (!localStorage.getItem(APP_META_KEY)) {
    updateAppMeta({ schemaVersion: CURRENT_SCHEMA_VERSION });
    return { ran, failed: null, finalVersion: CURRENT_SCHEMA_VERSION };
  }

  let version = meta.schemaVersion;

  while (version < CURRENT_SCHEMA_VERSION) {
    const next = version + 1;
    const migration = MIGRATIONS[next];
    if (!migration) {
      // Gap in migrations — should not happen, but do not silently advance.
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: false,
        error: `No migration registered for target version ${next}`,
      };
      const m = readAppMeta();
      updateAppMeta({ history: [...m.history, record] });
      return { ran, failed: record, finalVersion: version };
    }

    let backupKey: string | undefined;
    try {
      backupKey = writePreMigrationBackup(version, next);
    } catch (err) {
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: false,
        error: `Pre-migration backup failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      const m = readAppMeta();
      updateAppMeta({ history: [...m.history, record] });
      return { ran, failed: record, finalVersion: version };
    }

    try {
      await migration();
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: true,
        backupKey,
      };
      const m = readAppMeta();
      updateAppMeta({
        schemaVersion: next,
        history: [...m.history, record],
      });
      ran.push(record);
      version = next;
    } catch (err) {
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        backupKey,
      };
      const m = readAppMeta();
      updateAppMeta({ history: [...m.history, record] });
      return { ran, failed: record, finalVersion: version };
    }
  }

  return { ran, failed: null, finalVersion: version };
}

/**
 * Lists all pre-migration backups currently in localStorage.
 * Surfaced by the error boundary and Settings for manual recovery.
 */
export function listPreMigrationBackups(): { key: string; sizeBytes: number }[] {
  const out: { key: string; sizeBytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BACKUP_KEY_PREFIX)) {
        const v = localStorage.getItem(k) ?? '';
        out.push({ key: k, sizeBytes: v.length });
      }
    }
  } catch {
    // ignore
  }
  out.sort((a, b) => b.key.localeCompare(a.key)); // newest first
  return out;
}
