/**
 * App-wide schema versioning and migration history.
 *
 * Stored in localStorage under `app-meta`. Read at app boot, written by
 * the migration runner. The migration runner uses `schemaVersion` to
 * determine which migrations to run and records each run in `history`.
 *
 * Never mutate these shapes without bumping `CURRENT_SCHEMA_VERSION` and
 * writing a migration.
 */

export interface MigrationRecord {
  /** Target version this migration moved the schema to */
  toVersion: number;
  /** ISO timestamp */
  ranAt: string;
  /** Whether the migration succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Key of the pre-migration backup in localStorage */
  backupKey?: string;
}

/**
 * Which storage backend the managed big-store keys live on.
 *   'localStorage' — the default; sync reads, ~5 MB cap.
 *   'indexedDB'    — opt-in via Settings > Advanced. Larger cap, non-blocking.
 *
 * Switching is user-driven via switchBackend(), which runs a backup +
 * copy + verify cycle before updating this flag. If the flag disagrees
 * with reality at boot (e.g. IDB disabled by browser), main.tsx falls
 * back to localStorage and corrects the flag.
 */
export type DataBackend = 'localStorage' | 'indexedDB';

export interface AppMeta {
  /** Current schema version the stored data conforms to */
  schemaVersion: number;
  /** Version of the app that last ran (from package.json) */
  lastAppVersion: string | null;
  /** ISO timestamp of the last successful export (manual or auto) */
  lastBackupAt: string | null;
  /** Ordered log of migrations that have run */
  history: MigrationRecord[];
  /** Whether the user has acknowledged the pre-update backup prompt for `lastAppVersion` */
  preUpdateAckVersion: string | null;
  /** Which storage backend the big-store keys live on. */
  dataBackend: DataBackend;
}

export const APP_META_KEY = 'app-meta';

/**
 * The schema version this build of the app expects.
 * Bump this whenever you add a migration.
 */
export const CURRENT_SCHEMA_VERSION = 0;

const EMPTY_META: AppMeta = {
  schemaVersion: 0,
  lastAppVersion: null,
  lastBackupAt: null,
  history: [],
  preUpdateAckVersion: null,
  dataBackend: 'localStorage',
};

/**
 * Reads app-meta from localStorage. Returns a safe default if missing or malformed.
 * Never throws.
 */
export function readAppMeta(): AppMeta {
  try {
    const raw = localStorage.getItem(APP_META_KEY);
    if (!raw) return { ...EMPTY_META };
    const parsed = JSON.parse(raw);
    // Defensive: if shape is unexpected, fall back to defaults rather than crashing
    return {
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0,
      lastAppVersion: typeof parsed.lastAppVersion === 'string' ? parsed.lastAppVersion : null,
      lastBackupAt: typeof parsed.lastBackupAt === 'string' ? parsed.lastBackupAt : null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      preUpdateAckVersion: typeof parsed.preUpdateAckVersion === 'string' ? parsed.preUpdateAckVersion : null,
      dataBackend: parsed.dataBackend === 'indexedDB' ? 'indexedDB' : 'localStorage',
    };
  } catch {
    return { ...EMPTY_META };
  }
}

export function writeAppMeta(meta: AppMeta): void {
  try {
    localStorage.setItem(APP_META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full or unavailable — intentionally swallow so app continues to run.
    // The migration runner logs errors via its own channel.
  }
}

export function updateAppMeta(patch: Partial<AppMeta>): AppMeta {
  const current = readAppMeta();
  const next = { ...current, ...patch };
  writeAppMeta(next);
  return next;
}
