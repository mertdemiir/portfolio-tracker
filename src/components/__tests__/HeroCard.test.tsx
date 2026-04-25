import { describe, it, expect } from 'vitest';
import { sliceSnapshotsForRange } from '../HeroCard';
import type { PortfolioSnapshot } from '../../types';

const makeSnap = (date: string, nw: number): PortfolioSnapshot => ({
  date,
  totalValue: nw,
  netWorthValue: nw,
});

/**
 * We don't render the HeroCard here — Recharts + ResponsiveContainer
 * need a real layout engine. Instead we exercise the pure helper that
 * powers the range pills.
 */
describe('HeroCard.sliceSnapshotsForRange', () => {
  it('returns zeros for an empty snapshot array', () => {
    const r = sliceSnapshotsForRange([], '1M');
    expect(r.sliced).toEqual([]);
    expect(r.deltaAmt).toBe(0);
    expect(r.deltaPct).toBe(0);
    expect(r.low).toBe(0);
    expect(r.high).toBe(0);
  });

  it('ALL returns every snapshot, sorted ascending', () => {
    const snaps = [
      makeSnap('2024-03-01', 300),
      makeSnap('2024-01-01', 100),
      makeSnap('2024-02-01', 200),
    ];
    const r = sliceSnapshotsForRange(snaps, 'ALL');
    expect(r.sliced.map((s) => s.value)).toEqual([100, 200, 300]);
    expect(r.deltaAmt).toBe(200);
    expect(r.deltaPct).toBeCloseTo(200, 6); // (300−100)/100 × 100
  });

  it('1M slices the last 30 datapoints when more exist', () => {
    const snaps = Array.from({ length: 60 }, (_, i) =>
      makeSnap(`2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`, 100 + i),
    );
    const r = sliceSnapshotsForRange(snaps, '1M');
    expect(r.sliced).toHaveLength(30);
    expect(r.sliced[0].value).toBe(130); // first day of last 30
    expect(r.sliced.at(-1)?.value).toBe(159);
  });

  it('records min and max across the sliced range', () => {
    const snaps = [
      makeSnap('2024-01-01', 50),
      makeSnap('2024-02-01', 150),
      makeSnap('2024-03-01', 100),
    ];
    const r = sliceSnapshotsForRange(snaps, 'ALL');
    expect(r.low).toBe(50);
    expect(r.high).toBe(150);
  });

  it('falls back to totalValue when netWorthValue is undefined', () => {
    const snaps: PortfolioSnapshot[] = [
      { date: '2024-01-01', totalValue: 100 } as PortfolioSnapshot,
      { date: '2024-02-01', totalValue: 200 } as PortfolioSnapshot,
    ];
    const r = sliceSnapshotsForRange(snaps, 'ALL');
    // sliced.value comes from netWorthValue ?? totalValue
    expect(r.sliced[0].value).toBe(100);
    expect(r.sliced[1].value).toBe(200);
  });

  it('deltaPct is 0 (not Infinity / NaN) when first value is 0', () => {
    const snaps = [
      { date: '2024-01-01', totalValue: 0, netWorthValue: 0 },
      { date: '2024-02-01', totalValue: 100, netWorthValue: 100 },
    ];
    const r = sliceSnapshotsForRange(snaps, 'ALL');
    expect(r.deltaPct).toBe(0);
  });
});
