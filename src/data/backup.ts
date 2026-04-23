/**
 * Unified backup payload construction.
 *
 * Every export path (manual, auto, pre-migration) routes through
 * `gatherBackupData`. This is the single source of truth for what
 * gets exported. Never read localStorage for backup purposes outside
 * this file.
 *
 * Backup format is JSON with a `version` field so future readers can
 * dispatch on format. Bump `BACKUP_FORMAT_VERSION` when the payload
 * shape changes in a breaking way.
 */

import { APP_META_KEY } from './schema';

export const BACKUP_FORMAT_VERSION = 2;

export interface BackupPayload {
  version: number;
  exportedAt: string;
  exportedBy: 'manual' | 'auto' | 'pre-migration';
  appMeta: unknown;
  holdings: unknown;
  snapshots: unknown;
  customCategories: unknown;
  apiKey: string;
  transactions: unknown;
  targetAllocations: unknown;
  nwTarget: unknown;
  nwMilestones: unknown;
  benchmarkDataSpx: unknown;
  benchmarkDataBtc: unknown;
  benchmarkDataGold: unknown;
  benchmarkEnabled: unknown;
  accentColor: string;
  watchlistItems: unknown;
  watchlistPriceCache: unknown;
  priceCache: unknown;
  holdingOrder: unknown;
  baseCurrency: string;
  portfolios: unknown;
  activePortfolio: string;
  liabilities: unknown;
  annotations: unknown;
  theme: string;
  fireSettings: unknown;
  autoBackupSettings: unknown;
  digestDismissedDate: string;
}

/**
 * Safely reads a JSON-encoded value from localStorage. Returns `fallback`
 * if missing or malformed.
 */
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Reads a raw string value from localStorage, stripping surrounding JSON quotes
 * if present (older code stored raw strings JSON-encoded).
 */
function readString(key: string, fallback: string): string {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw.replace(/^"|"$/g, '');
}

/**
 * Builds a complete snapshot of all persisted user data for export.
 * This is the ONLY function that defines the backup shape.
 */
export function gatherBackupData(
  exportedBy: BackupPayload['exportedBy'] = 'manual'
): BackupPayload {
  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    appMeta: readJson(APP_META_KEY, null),
    holdings: readJson('portfolio-holdings', []),
    snapshots: readJson('portfolio-snapshots', []),
    customCategories: readJson('custom-categories', []),
    apiKey: readString('finnhub-api-key', ''),
    transactions: readJson('transactions', []),
    targetAllocations: readJson('target-allocations', []),
    nwTarget: readJson('nw-target', null),
    nwMilestones: readJson('nw-milestones', []),
    benchmarkDataSpx: readJson('benchmark-data-spx', []),
    benchmarkDataBtc: readJson('benchmark-data-btc', []),
    benchmarkDataGold: readJson('benchmark-data-gold', []),
    benchmarkEnabled: readJson('benchmark-enabled', {}),
    accentColor: readString('accent-color', '#3b82f6'),
    watchlistItems: readJson('watchlist-items', []),
    watchlistPriceCache: readJson('watchlist-price-cache', {}),
    priceCache: readJson('price-cache', {}),
    holdingOrder: readJson('holding-order', []),
    baseCurrency: readString('base-currency', 'USD'),
    portfolios: readJson('portfolios', []),
    activePortfolio: readString('active-portfolio', 'all'),
    liabilities: readJson('liabilities', []),
    annotations: readJson('timeline-annotations', []),
    theme: readString('theme', 'dark'),
    fireSettings: readJson('fire-settings', {}),
    autoBackupSettings: readJson('auto-backup-settings', {}),
    digestDismissedDate: readString('digest-dismissed-date', ''),
  };
}

/**
 * Serializes a backup payload to pretty JSON (2-space indented) for storage
 * or file download.
 */
export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and validates a backup string. Returns the payload or throws a
 * descriptive error. Callers must handle the exception.
 */
export function parseBackup(jsonString: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup is not an object.');
  }
  const p = parsed as Partial<BackupPayload>;
  if (typeof p.version !== 'number') {
    throw new Error('Backup missing version field.');
  }
  if (!Array.isArray(p.holdings) && p.holdings !== undefined) {
    throw new Error('Backup holdings field is not an array.');
  }
  // Minimally permissive — we accept older formats (v1) and older apps may
  // have written subsets. Any missing fields become their fallback values
  // during restore.
  return parsed as BackupPayload;
}
