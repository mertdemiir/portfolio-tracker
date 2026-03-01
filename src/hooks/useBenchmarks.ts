import { useCallback, useEffect, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { parseCsv } from '../utils/csvParser';
import { DEFAULT_SPX, DEFAULT_BTC, DEFAULT_GOLD } from '../data/benchmarkDefaults';
import type { BenchmarkDataPoint, BenchmarkEnabled, BenchmarkId } from '../types';

export function useBenchmarks() {
  const [dataSpx, setDataSpx] = useLocalStorage<BenchmarkDataPoint[]>('benchmark-data-spx', DEFAULT_SPX);
  const [dataBtc, setDataBtc] = useLocalStorage<BenchmarkDataPoint[]>('benchmark-data-btc', DEFAULT_BTC);
  const [dataGold, setDataGold] = useLocalStorage<BenchmarkDataPoint[]>('benchmark-data-gold', DEFAULT_GOLD);
  const [benchmarkEnabled, setBenchmarkEnabled] = useLocalStorage<BenchmarkEnabled>(
    'benchmark-enabled',
    { spx: false, btc: false, gold: false }
  );

  // Migration: clean up old keys from API-based approach
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;

    // Remove old benchmark-snapshots key
    localStorage.removeItem('benchmark-snapshots');

    // Migrate old benchmark-enabled format { spy, btc } → { spx, btc, gold }
    try {
      const raw = localStorage.getItem('benchmark-enabled');
      if (raw) {
        const parsed = JSON.parse(raw);
        if ('spy' in parsed && !('spx' in parsed)) {
          const newEnabled: BenchmarkEnabled = {
            spx: !!parsed.spy,
            btc: !!parsed.btc,
            gold: false,
          };
          localStorage.setItem('benchmark-enabled', JSON.stringify(newEnabled));
          setBenchmarkEnabled(newEnabled);
        }
      }
    } catch {
      // ignore migration errors
    }
  }, [setBenchmarkEnabled]);

  const benchmarkData = { spx: dataSpx, btc: dataBtc, gold: dataGold };

  const setterMap: Record<BenchmarkId, React.Dispatch<React.SetStateAction<BenchmarkDataPoint[]>>> = {
    spx: setDataSpx,
    btc: setDataBtc,
    gold: setDataGold,
  };

  const toggleBenchmark = useCallback(
    (key: BenchmarkId) => {
      setBenchmarkEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [setBenchmarkEnabled]
  );

  const importBenchmarkCsv = useCallback(
    (key: BenchmarkId, csvText: string): { success: boolean; count: number; error?: string } => {
      try {
        const { headers, rows } = parseCsv(csvText);

        // Find time and close columns (case-insensitive)
        const timeHeader = headers.find((h) => h.toLowerCase().trim() === 'time');
        const closeHeader = headers.find((h) => h.toLowerCase().trim() === 'close');

        if (!timeHeader || !closeHeader) {
          return { success: false, count: 0, error: 'CSV must have "time" and "close" columns.' };
        }

        const dateMap = new Map<string, number>();

        for (const row of rows) {
          const timeVal = Number(row[timeHeader]);
          const closeVal = Number(row[closeHeader]);

          if (isNaN(timeVal) || isNaN(closeVal) || closeVal <= 0 || timeVal <= 0) continue;

          // Convert Unix timestamp (seconds) to YYYY-MM-DD
          const date = new Date(timeVal * 1000).toISOString().split('T')[0];
          dateMap.set(date, closeVal); // last value wins if duplicate
        }

        if (dateMap.size === 0) {
          return { success: false, count: 0, error: 'No valid data rows found in CSV.' };
        }

        const points: BenchmarkDataPoint[] = Array.from(dateMap.entries())
          .map(([date, close]) => ({ date, close }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setterMap[key](points);
        return { success: true, count: points.length };
      } catch (err) {
        return { success: false, count: 0, error: `Failed to parse CSV: ${err}` };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setDataSpx, setDataBtc, setDataGold]
  );

  const clearBenchmark = useCallback(
    (key: BenchmarkId) => {
      setterMap[key]([]);
      setBenchmarkEnabled((prev) => ({ ...prev, [key]: false }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setDataSpx, setDataBtc, setDataGold, setBenchmarkEnabled]
  );

  const getBenchmarkDateRange = useCallback(
    (key: BenchmarkId): { from: string; to: string; count: number } | null => {
      const data = benchmarkData[key];
      if (data.length === 0) return null;
      return {
        from: data[0].date,
        to: data[data.length - 1].date,
        count: data.length,
      };
    },
    [dataSpx, dataBtc, dataGold] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    benchmarkData,
    benchmarkEnabled,
    toggleBenchmark,
    importBenchmarkCsv,
    clearBenchmark,
    getBenchmarkDateRange,
  };
}
