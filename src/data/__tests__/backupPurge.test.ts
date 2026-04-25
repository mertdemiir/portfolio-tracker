import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runMigrations } from '../migrations';
import { writeAppMeta } from '../schema';

/**
 * Verifies the age-based backup purge added in Phase 5.2.
 *
 * The runner's purgeOldBackups now drops any __pre_migration_* backup
 * older than 30 days, in addition to the existing count cap. We can't
 * import the helper directly (it's module-private), so we exercise it
 * through the public migration runner: seed an old backup key, run
 * migrations, assert the old key is gone but a fresh one remains.
 */
describe('pre-migration backup purge — age-based', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('drops backups older than 30 days; keeps recent ones', async () => {
    // Pin "now" so the runner's freshly-created backup key is timestamped
    // at a known point.
    const now = new Date('2026-04-25T00:00:00.000Z');
    vi.setSystemTime(now);

    // Seed two old backups: 60 days old and 5 days old.
    const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/[:.]/g, '-');
    const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/[:.]/g, '-');
    const oldKey = `__pre_migration_0_to_1_${oldDate}`;
    const recentKey = `__pre_migration_1_to_2_${recentDate}`;
    localStorage.setItem(oldKey, '"old-data"');
    localStorage.setItem(recentKey, '"recent-data"');

    // Set a stored schema version below current so the runner triggers
    // a migration → which in turn triggers purgeOldBackups.
    writeAppMeta({
      schemaVersion: 0,
      lastAppVersion: '1.4.0',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.4.0',
      dataBackend: 'localStorage',
    });
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1', ticker: 'AAPL' }]));

    await runMigrations();

    // The 60-day-old key must be gone. The 5-day-old one survives.
    expect(localStorage.getItem(oldKey)).toBeNull();
    expect(localStorage.getItem(recentKey)).not.toBeNull();
  });
});
