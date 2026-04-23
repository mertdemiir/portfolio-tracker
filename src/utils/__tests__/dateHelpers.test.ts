import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  formatMonthDay,
  formatMonthYear,
  formatLongDate,
  formatMonthShortYear,
  addDays,
  todayLocalDateString,
} from '../dateHelpers';

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD as local midnight (regression: #18 UTC shift)', () => {
    const d = parseLocalDate('2026-01-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('strips trailing time portion if present', () => {
    const d = parseLocalDate('2026-01-05T12:30:00');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });

  it('returns invalid date for empty string', () => {
    expect(Number.isNaN(parseLocalDate('').getTime())).toBe(true);
  });

  it('returns invalid date for malformed input', () => {
    expect(Number.isNaN(parseLocalDate('not a date').getTime())).toBe(true);
    expect(Number.isNaN(parseLocalDate('2026-01').getTime())).toBe(true);
  });

  it('does not drift a day regardless of timezone', () => {
    // The legacy bug: new Date('2026-01-01') in America/Los_Angeles renders
    // "Dec 31, 2025". Our parser must always return the calendar date in
    // local time, so getDate() === 1 on this input no matter the TZ.
    const d = parseLocalDate('2026-01-01');
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(0);
  });
});

describe('format helpers', () => {
  it('formatMonthDay returns "MMM d"', () => {
    expect(formatMonthDay('2026-01-05')).toBe('Jan 5');
  });

  it('formatMonthYear returns "MMM yyyy"', () => {
    expect(formatMonthYear('2026-01-05')).toBe('Jan 2026');
  });

  it('formatLongDate returns "MMM d, yyyy"', () => {
    expect(formatLongDate('2026-01-05')).toBe('Jan 5, 2026');
  });

  it('formatMonthShortYear returns "MMM \'yy"', () => {
    expect(formatMonthShortYear('2026-01-05')).toBe('Jan 26');
  });

  it('returns the input string on invalid dates rather than "Invalid Date"', () => {
    expect(formatMonthDay('bad-input')).toBe('bad-input');
    expect(formatMonthYear('')).toBe('');
  });
});

describe('addDays', () => {
  it('adds days and rolls over months', () => {
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
  });

  it('subtracts days with negative input', () => {
    expect(addDays('2026-01-05', -10)).toBe('2025-12-26');
  });

  it('passes through invalid input unchanged', () => {
    expect(addDays('bad', 5)).toBe('bad');
  });
});

describe('todayLocalDateString', () => {
  it('returns YYYY-MM-DD matching the local Date parts', () => {
    const result = todayLocalDateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});
