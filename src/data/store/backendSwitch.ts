/**
 * Switches the active storage backend (localStorage ↔ IndexedDB) while
 * preserving every byte of user data.
 *
 * Safety model (do not simplify — this is the entire reason this
 * module exists):
 *
 *   1. Write a manual backup first. If the user rejects the save
 *      dialog, we abort. Written against the CURRENT backend so the
 *      backup captures reality-at-rest.
 *   2. Initialize the target adapter. If this fails (e.g. IDB
 *      disabled by the browser), we abort and leave everything where
 *      it was — no flag change, no data touched.
 *   3. For every managed key present in the current backend, copy
 *      it to the target.
 *   4. Verify the copy: read back every key from the target, assert
 *      it exists and its JSON-serialized form matches the source.
 *      If any key fails verification, abort and leave the flag
 *      untouched. The source backend is never modified, so the user
 *      can retry after diagnosing.
 *   5. Update app-meta.dataBackend to the new target.
 *   6. Leave the source backend's data INTACT. It's the rollback
 *      path: a future `switchBackend(oppositeDirection)` reads from
 *      the source (which is now the target of the rollback).
 *
 * The caller is expected to reload the app after success so the boot
 * sequence picks up the new adapter.
 */

import type { StorageAdapter } from './types';
import { MANAGED_STORE_KEYS } from './types';
import { LocalStorageAdapter } from './localStorageAdapter';
import { IndexedDbAdapter } from './indexedDbAdapter';
import { updateAppMeta, type DataBackend } from '../schema';
import { gatherBackupData, serializeBackup } from '../backup';

export interface SwitchResult {
  ok: boolean;
  /** Number of keys copied (0 if aborted before copy). */
  copied: number;
  /** One per key that failed verification (empty on success). */
  verificationFailures: string[];
  /** Diagnostic / failure message for the UI. */
  message: string;
}

export interface SwitchOptions {
  /** Pre-switch backup behavior. 'required' aborts on cancellation. */
  backup: 'required' | 'skip';
  /**
   * The current (source) adapter. Typically the singleton returned by
   * getAdapter() — but callers may pass a fresh instance in tests.
   */
  source: StorageAdapter;
}

/**
 * Creates a fresh adapter instance for the given backend. Does NOT
 * init — callers must do that.
 */
export function makeAdapter(backend: DataBackend): StorageAdapter {
  return backend === 'indexedDB' ? new IndexedDbAdapter() : new LocalStorageAdapter();
}

/**
 * Performs a full switch to the target backend. Returns a structured
 * result instead of throwing so the UI can show granular errors.
 *
 * Pre-conditions:
 *   - `source` is the current live adapter (already init'd + hydrated)
 *   - `target` differs from the current `app-meta.dataBackend`
 *
 * Post-condition on success:
 *   - Target adapter contains an identical copy of every managed key
 *   - `app-meta.dataBackend` points at the target
 *   - The source adapter is untouched (rollback path)
 *   - Caller should trigger a page reload so the new adapter is loaded
 *     at boot
 */
export async function switchBackend(
  target: DataBackend,
  options: SwitchOptions,
): Promise<SwitchResult> {
  // Step 1: backup
  if (options.backup === 'required') {
    const saved = await saveManualBackup();
    if (!saved) {
      return {
        ok: false,
        copied: 0,
        verificationFailures: [],
        message: 'Switch aborted — backup was not saved. Your data is unchanged.',
      };
    }
  }

  // Step 2: init target
  const targetAdapter = makeAdapter(target);
  try {
    await targetAdapter.init();
  } catch (err) {
    return {
      ok: false,
      copied: 0,
      verificationFailures: [],
      message: `Could not initialize ${target}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  // Close any IDB connection we opened once we're done so the app
  // reload doesn't race with a stale handle.
  const closeIfIdb = async () => {
    if ('close' in targetAdapter && typeof (targetAdapter as { close?: () => Promise<void> }).close === 'function') {
      await (targetAdapter as { close: () => Promise<void> }).close();
    }
  };

  // Step 3: copy every managed key that exists in the source
  let copied = 0;
  const copiedKeys: string[] = [];
  try {
    for (const key of MANAGED_STORE_KEYS) {
      const value = await options.source.get(key);
      if (value === null || value === undefined) continue;
      await targetAdapter.set(key, value);
      copiedKeys.push(key);
      copied++;
    }
  } catch (err) {
    await closeIfIdb();
    return {
      ok: false,
      copied,
      verificationFailures: [],
      message: `Copy aborted mid-flight: ${err instanceof Error ? err.message : String(err)}. Source backend is unchanged; current backend still active.`,
    };
  }

  // Step 4: verify by reading back + comparing JSON
  const failures: string[] = [];
  for (const key of copiedKeys) {
    const sourceValue = await options.source.get(key);
    const targetValue = await targetAdapter.get(key);
    const sourceJson = JSON.stringify(sourceValue);
    const targetJson = JSON.stringify(targetValue);
    if (sourceJson !== targetJson) {
      failures.push(key);
    }
  }
  if (failures.length > 0) {
    await closeIfIdb();
    return {
      ok: false,
      copied,
      verificationFailures: failures,
      message:
        `Verification failed for ${failures.length} key(s): ${failures.join(', ')}. ` +
        `Current backend is still active; target is in an inconsistent state.`,
    };
  }

  // Step 5: flip the flag
  updateAppMeta({ dataBackend: target });

  // Step 6: intentionally leave the source untouched for rollback.
  // Close the target's IDB connection so the subsequent page reload
  // can open a fresh one without racing on onblocked.
  await closeIfIdb();

  return {
    ok: true,
    copied,
    verificationFailures: [],
    message: `Copied ${copied} key(s) to ${target}. Reload the app to use the new backend.`,
  };
}

/**
 * Triggers an export via the Electron IPC if available, or a browser
 * download otherwise. Returns true on success, false on cancellation.
 */
async function saveManualBackup(): Promise<boolean> {
  const payload = serializeBackup(gatherBackupData('pre-migration'));
  const isElectron = !!window.electronAPI;
  if (isElectron) {
    const result = await window.electronAPI!.exportData(payload);
    return result.success === true;
  }
  try {
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-backup-pre-switch-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // We can't detect "cancelled" on a browser download; treat attempt as success.
    return true;
  } catch {
    return false;
  }
}
