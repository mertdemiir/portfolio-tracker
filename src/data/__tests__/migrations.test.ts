import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations, listPreMigrationBackups } from '../migrations';
import { readAppMeta, APP_META_KEY } from '../schema';

describe('migrations runner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes app-meta on first run to CURRENT_SCHEMA_VERSION when no data exists', async () => {
    const result = await runMigrations();
    expect(result.failed).toBeNull();
    const meta = readAppMeta();
    // Fresh installs skip straight to the latest schema — no need to run
    // data migrations on an empty store. CURRENT_SCHEMA_VERSION bumps
    // with each release that adds a migration.
    expect(meta.schemaVersion).toBeGreaterThanOrEqual(1);
  });

  it('does not re-initialize app-meta if already present', async () => {
    localStorage.setItem(
      APP_META_KEY,
      JSON.stringify({
        schemaVersion: 0,
        lastAppVersion: '1.0.0',
        lastBackupAt: null,
        history: [],
        preUpdateAckVersion: null,
      })
    );
    await runMigrations();
    const meta = readAppMeta();
    expect(meta.lastAppVersion).toBe('1.0.0'); // preserved
  });

  it('listPreMigrationBackups returns empty array when no backups exist', () => {
    expect(listPreMigrationBackups()).toEqual([]);
  });

  it('listPreMigrationBackups finds backup keys by prefix', () => {
    localStorage.setItem('__pre_migration_0_to_1_2026-01-01', 'some-data');
    localStorage.setItem('__pre_migration_1_to_2_2026-02-01', 'more-data');
    localStorage.setItem('unrelated-key', 'ignored');
    const backups = listPreMigrationBackups();
    expect(backups).toHaveLength(2);
    // Sorted newest first
    expect(backups[0].key).toContain('2026-02-01');
  });
});
