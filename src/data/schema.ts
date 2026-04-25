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
 *
 * History:
 *   0 — v1.0.0–v1.1.0. Pre-migration-runner. Data shapes as originally
 *       shipped.
 *   1 — v1.2.0. Normalizes portfolioId on every Holding + Transaction
 *       to DEFAULT_PORTFOLIO_ID when previously undefined. After this,
 *       portfolioId is always a string — the `|| DEFAULT_PORTFOLIO_ID`
 *       fallbacks sprinkled across the app become unnecessary.
 *   2 — v1.2.0. Unifies watchlist-price-cache into price-cache. The
 *       watchlist now shares the same price-cache table as the portfolio,
 *       so if the same ticker is in both, only one fetch is needed.
 *       The old watchlist-price-cache key is deleted after merge.
 *   3 — v1.3.0. Transactions become a first-class ledger. For every
 *       existing Holding that has no matching buy Transaction, synthesize
 *       one from the holding's buyPrice/shares/buyDate so the
 *       Holding ↔ buy-Transaction parity is 1:1 from now on. Also
 *       backfills `holdingId` on existing Transactions when a unique
 *       holding match exists for (ticker, portfolioId). Holdings remain
 *       authoritative for cost basis in v1.3.0 — this migration only
 *       establishes the ledger so a future release can flip the source
 *       of truth without data loss.
 *   4 — v1.4.3. Reconciles each Holding's ledger with its stored shape.
 *       Migration 3's "any buy exists → skip" check was too coarse:
 *       holdings with closed-and-reopened cycles often had real legacy
 *       buy/sell history that net out to zero, leaving the *current*
 *       open position unrepresented in the ledger. Migration 4 derives
 *       shares from the ledger using the chronological-reset algorithm
 *       and, for every holding where derived ≠ stored, appends a
 *       clearly-marked synthetic top-up buy or sell at a price chosen
 *       so the weighted-average buy price still equals the stored
 *       holding.buyPrice. Idempotent — running again is a no-op once
 *       the ledger agrees.
 *   5 — v1.4.4. Migration 4 had a date bug: it stamped synthetics at
 *       holding.buyDate, which for closed-and-reopened cycles can sit
 *       BEFORE the closing sell, allowing the sell to partially
 *       "consume" the synthetic's shares during the chronological
 *       walk. Migration 5 is a brute-force reconcile: for each non-
 *       cash holding it removes EVERY prior synthetic linked to that
 *       holding, re-derives shares from the cleaned ledger, then
 *       appends ONE corrective synthetic dated at MAX(buyDate,
 *       latest_contributing_txn_date) so it's chronologically last
 *       and can't be swallowed by a prior sell. Idempotent: re-
 *       running on already-reconciled data wipes and re-adds the
 *       same synthetic.
 *   6 — v1.4.5. Migration 5 only triggered on shares mismatch. Holdings
 *       where shares already matched but buyPrice diverged (e.g. user's
 *       stored holding.buyPrice differs from the real-txn weighted-avg)
 *       were skipped. Migration 6 supersedes migration 5 with a complete
 *       reconcile per non-cash holding: wipes ALL prior synthetics, then
 *       fixes shares with one synthetic (if needed) and fixes buyPrice
 *       with a synthetic-buy + synthetic-sell pair (net 0 share change
 *       but adjusts the weighted-average buyPrice). After migration 6
 *       runs, every non-cash holding's deriveHolding output exactly
 *       matches its stored shares + buyPrice. Idempotent.
 *   7 — v1.7.0. Phase 3 source-of-truth completion. The Settings flag
 *       now defaults to true and the ledger is canonically authoritative.
 *       Migration 7 verifies storage matches derivation for every
 *       non-cash holding; if any drift is detected (shouldn't happen
 *       post-mig-6 — only if the user manually edited storage), it
 *       writes the derived values back so storage stays an accurate
 *       cache of the ledger. We deliberately do NOT strip the
 *       shares/buyPrice/buyFxRate fields from Holding storage — too many
 *       consumers read them directly. Storage is now a ledger-derived
 *       cache rather than the source of truth. Idempotent.
 */
export const CURRENT_SCHEMA_VERSION = 7;

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
