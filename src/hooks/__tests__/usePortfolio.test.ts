import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePortfolio } from '../usePortfolio';
import { todayDateString } from '../../utils/formatters';

describe('usePortfolio — saveSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists totalLiabilities = 0 instead of dropping it (regression: #9)', () => {
    const { result } = renderHook(() => usePortfolio());
    act(() => {
      result.current.saveSnapshot(10000, 8000, 0);
    });
    const today = todayDateString();
    const snap = result.current.snapshots.find((s) => s.date === today);
    expect(snap).toBeDefined();
    expect(snap?.totalLiabilities).toBe(0);
  });

  it('persists non-zero totalLiabilities', () => {
    const { result } = renderHook(() => usePortfolio());
    act(() => {
      result.current.saveSnapshot(10000, 8000, 2500);
    });
    const today = todayDateString();
    const snap = result.current.snapshots.find((s) => s.date === today);
    expect(snap?.totalLiabilities).toBe(2500);
  });

  it('omits totalLiabilities when caller passes undefined', () => {
    const { result } = renderHook(() => usePortfolio());
    act(() => {
      result.current.saveSnapshot(10000, 8000, undefined);
    });
    const today = todayDateString();
    const snap = result.current.snapshots.find((s) => s.date === today);
    expect(snap).toBeDefined();
    expect(snap?.totalLiabilities).toBeUndefined();
  });

  it('updates manual snapshot with new zero liabilities without overwriting name or NW', () => {
    const { result } = renderHook(() => usePortfolio());
    const today = todayDateString();

    act(() => {
      result.current.addManualSnapshot(today, 15000, 12000, 'Year-end');
    });
    expect(result.current.snapshots.find((s) => s.date === today)?.name).toBe('Year-end');

    // Now saveSnapshot fires with 0 liabilities — should update the 0 and
    // update portfolioValue, but preserve the manual name + netWorthValue.
    act(() => {
      result.current.saveSnapshot(99999, 11000, 0);
    });
    const updated = result.current.snapshots.find((s) => s.date === today);
    expect(updated?.name).toBe('Year-end');
    expect(updated?.netWorthValue).toBe(15000); // preserved manual NW
    expect(updated?.portfolioValue).toBe(11000); // updated
    expect(updated?.totalLiabilities).toBe(0); // updated (was previously dropped)
  });

  it('updating snapshot twice same day keeps one entry', () => {
    const { result } = renderHook(() => usePortfolio());
    act(() => {
      result.current.saveSnapshot(10000, 8000, 0);
    });
    act(() => {
      result.current.saveSnapshot(10500, 8500, 0);
    });
    const today = todayDateString();
    const matches = result.current.snapshots.filter((s) => s.date === today);
    expect(matches).toHaveLength(1);
    expect(matches[0].netWorthValue).toBe(10500);
  });
});
