import { describe, it, expect, beforeEach } from 'vitest';
import { gatherBackupData, serializeBackup, parseBackup, BACKUP_FORMAT_VERSION } from '../backup';

describe('backup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gathers empty defaults when storage is empty', () => {
    const payload = gatherBackupData('manual');
    expect(payload.version).toBe(BACKUP_FORMAT_VERSION);
    expect(payload.exportedBy).toBe('manual');
    expect(payload.holdings).toEqual([]);
    expect(payload.snapshots).toEqual([]);
    expect(payload.baseCurrency).toBe('USD');
    expect(payload.theme).toBe('dark');
  });

  it('round-trips through serialize and parse', () => {
    localStorage.setItem('portfolio-holdings', JSON.stringify([{ id: 'h1', ticker: 'AAPL' }]));
    localStorage.setItem('base-currency', JSON.stringify('EUR'));
    const serialized = serializeBackup(gatherBackupData('manual'));
    const parsed = parseBackup(serialized);
    expect(parsed.holdings).toEqual([{ id: 'h1', ticker: 'AAPL' }]);
    expect(parsed.baseCurrency).toBe('EUR');
  });

  it('parseBackup throws on invalid JSON', () => {
    expect(() => parseBackup('not json{')).toThrow(/Invalid JSON/);
  });

  it('parseBackup throws when version field is missing', () => {
    expect(() => parseBackup(JSON.stringify({ holdings: [] }))).toThrow(/missing version/);
  });

  it('handles malformed localStorage values by falling back to defaults', () => {
    localStorage.setItem('portfolio-holdings', 'not-valid-json');
    const payload = gatherBackupData('manual');
    expect(payload.holdings).toEqual([]);
  });

  it('tags exportedBy correctly for each caller type', () => {
    expect(gatherBackupData('manual').exportedBy).toBe('manual');
    expect(gatherBackupData('auto').exportedBy).toBe('auto');
    expect(gatherBackupData('pre-migration').exportedBy).toBe('pre-migration');
  });
});
