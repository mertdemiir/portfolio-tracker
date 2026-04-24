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

function purgeOldBackups(keepCount: number): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BACKUP_KEY_PREFIX)) keys.push(k);
    }
    // Sort oldest-first (timestamp is embedded so lexical sort works)
    keys.sort();
    const toRemove = keys.slice(0, Math.max(0, keys.length - keepCount));
    for (const k of toRemove) {
      localStorage.removeItem(k);
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
