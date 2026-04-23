import { describe, it, expect, beforeEach } from 'vitest';
import { readAppMeta, writeAppMeta, updateAppMeta, APP_META_KEY } from '../schema';

describe('schema', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns safe defaults when app-meta missing', () => {
    const meta = readAppMeta();
    expect(meta.schemaVersion).toBe(0);
    expect(meta.lastAppVersion).toBeNull();
    expect(meta.lastBackupAt).toBeNull();
    expect(meta.history).toEqual([]);
    expect(meta.preUpdateAckVersion).toBeNull();
  });

  it('returns defaults when app-meta is malformed JSON', () => {
    localStorage.setItem(APP_META_KEY, 'not-json{');
    const meta = readAppMeta();
    expect(meta.schemaVersion).toBe(0);
    expect(meta.history).toEqual([]);
  });

  it('coerces unexpected shapes to defaults field by field', () => {
    localStorage.setItem(
      APP_META_KEY,
      JSON.stringify({ schemaVersion: 'oops', history: 'also-not-array', foo: 'bar' })
    );
    const meta = readAppMeta();
    expect(meta.schemaVersion).toBe(0);
    expect(meta.history).toEqual([]);
  });

  it('writes and reads back app-meta', () => {
    writeAppMeta({
      schemaVersion: 3,
      lastAppVersion: '1.2.3',
      lastBackupAt: '2026-01-01T00:00:00Z',
      history: [{ toVersion: 1, ranAt: 'now', success: true }],
      preUpdateAckVersion: '1.2.3',
    });
    const meta = readAppMeta();
    expect(meta.schemaVersion).toBe(3);
    expect(meta.lastAppVersion).toBe('1.2.3');
    expect(meta.history).toHaveLength(1);
  });

  it('updateAppMeta merges patch onto existing', () => {
    writeAppMeta({
      schemaVersion: 1,
      lastAppVersion: '1.0.0',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: null,
    });
    updateAppMeta({ lastBackupAt: '2026-01-02T00:00:00Z' });
    const meta = readAppMeta();
    expect(meta.schemaVersion).toBe(1);
    expect(meta.lastAppVersion).toBe('1.0.0');
    expect(meta.lastBackupAt).toBe('2026-01-02T00:00:00Z');
  });
});
