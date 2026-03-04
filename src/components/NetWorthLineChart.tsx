import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import type { PortfolioSnapshot, NWMilestone, BenchmarkDataPoint, BenchmarkEnabled, BenchmarkId, TimeRange, TimelineAnnotation } from '../types';
import { BENCHMARK_CONFIG } from '../types';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';

interface NetWorthLineChartProps {
  snapshots: PortfolioSnapshot[];
  milestones?: NWMilestone[];
  benchmarkData?: { spx: BenchmarkDataPoint[]; btc: BenchmarkDataPoint[]; gold: BenchmarkDataPoint[] };
  benchmarkEnabled?: BenchmarkEnabled;
  timeRange?: TimeRange;
  annotations?: TimelineAnnotation[];
  showAnnotations?: boolean;
}

/** Filter snapshots by time range — exported for reuse */
export function filterByTimeRange(snapshots: PortfolioSnapshot[], range: TimeRange): PortfolioSnapshot[] {
  const cutoff = getTimeRangeStart(range);
  return cutoff ? snapshots.filter((s) => s.date >= cutoff) : snapshots;
}

/** Return YYYY-MM-DD cutoff date for a time range */
function getTimeRangeStart(range: TimeRange): string | null {
  if (range === 'ALL') return null;
  const now = new Date();
  switch (range) {
    case '1M': now.setMonth(now.getMonth() - 1); break;
    case '3M': now.setMonth(now.getMonth() - 3); break;
    case '6M': now.setMonth(now.getMonth() - 6); break;
    case '1Y': now.setFullYear(now.getFullYear() - 1); break;
  }
  return now.toISOString().split('T')[0];
}

/**
 * Binary search carry-forward: find the most recent benchmark close <= targetDate.
 * Returns null if no data point exists on or before the target date.
 */
function findClosestValue(sortedData: BenchmarkDataPoint[], targetDate: string): number | null {
  if (sortedData.length === 0) return null;

  let lo = 0;
  let hi = sortedData.length - 1;

  // If target is before all data, no carry-forward possible
  if (targetDate < sortedData[0].date) return null;

  // If target is at or after last data point, return last
  if (targetDate >= sortedData[hi].date) return sortedData[hi].close;

  // Binary search for largest date <= targetDate
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (sortedData[mid].date <= targetDate) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return sortedData[lo].date <= targetDate ? sortedData[lo].close : null;
}

export function NetWorthLineChart({
  snapshots,
  milestones = [],
  benchmarkData,
  benchmarkEnabled = { spx: false, btc: false, gold: false },
  timeRange = 'ALL',
  annotations = [],
  showAnnotations = false,
}: NetWorthLineChartProps) {
  const { theme } = usePortfolioContext();
  const cc = getChartColors(theme);
  const showBenchmarks = benchmarkEnabled.spx || benchmarkEnabled.btc || benchmarkEnabled.gold;

  // Build a map from formatted date label → annotations for that date (for ReferenceLine matching)
  const visibleAnnotations = showAnnotations ? annotations : [];

  // Apply time range filter
  const cutoff = getTimeRangeStart(timeRange);
  const filteredSnapshots = cutoff
    ? snapshots.filter((s) => s.date >= cutoff)
    : snapshots;

  if (filteredSnapshots.length < 2) {
    return (
      <div className="bg-surface-card card-radius card-shadow p-5">
        <h3 className="text-sm font-semibold text-t-primary mb-4">Net Worth Over Time</h3>
        <div className="flex items-center justify-center h-[260px] text-sm text-t-muted">
          {snapshots.length < 2
            ? 'Net worth history will appear after 2+ days of snapshots.'
            : 'No data in selected time range.'}
        </div>
      </div>
    );
  }

  if (showBenchmarks && benchmarkData) {
    // ── Normalized % change view ──
    const sortedSnapshots = [...filteredSnapshots].sort((a, b) => a.date.localeCompare(b.date));
    const firstNW = sortedSnapshots[0].netWorthValue ?? sortedSnapshots[0].totalValue;

    // Determine which benchmarks are enabled and have data
    const enabledKeys = (Object.keys(BENCHMARK_CONFIG) as BenchmarkId[]).filter(
      (k) => benchmarkEnabled[k] && benchmarkData[k].length > 0
    );

    // Find first benchmark values for normalization base (using carry-forward from first NW date)
    const firstBenchmarkValues: Record<string, number | null> = {};
    for (const key of enabledKeys) {
      firstBenchmarkValues[key] = findClosestValue(benchmarkData[key], sortedSnapshots[0].date);
    }

    const data = sortedSnapshots.map((s) => {
      const nwVal = s.netWorthValue ?? s.totalValue;
      const nwPct = firstNW > 0 ? ((nwVal - firstNW) / firstNW) * 100 : 0;

      const point: Record<string, number | string> = {
        date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        nw: parseFloat(nwPct.toFixed(2)),
      };

      for (const key of enabledKeys) {
        const currentVal = findClosestValue(benchmarkData[key], s.date);
        const baseVal = firstBenchmarkValues[key];
        if (currentVal !== null && baseVal !== null && baseVal > 0) {
          point[key] = parseFloat((((currentVal - baseVal) / baseVal) * 100).toFixed(2));
        }
      }

      return point;
    });

    // Calculate Y-axis domain
    const allValues = data.flatMap((d) => {
      const vals: number[] = [d.nw as number];
      for (const key of enabledKeys) {
        if (key in d && typeof d[key] === 'number') vals.push(d[key] as number);
      }
      return vals;
    });

    const minVal = allValues.reduce((a, b) => Math.min(a, b), 0);
    const maxVal = allValues.reduce((a, b) => Math.max(a, b), 0);
    const range = maxVal - minVal || 10;
    const padding = range * 0.15;

    // Summary stats: last % change values
    const lastPoint = data[data.length - 1];
    const summaryItems: { key: string; label: string; color: string; value: number }[] = [
      { key: 'nw', label: 'Net Worth', color: '#10b981', value: lastPoint.nw as number },
    ];
    for (const key of enabledKeys) {
      if (key in lastPoint && typeof lastPoint[key] === 'number') {
        summaryItems.push({
          key,
          label: BENCHMARK_CONFIG[key].shortLabel,
          color: BENCHMARK_CONFIG[key].color,
          value: lastPoint[key] as number,
        });
      }
    }

    return (
      <div className="bg-surface-card card-radius card-shadow p-5">
        <h3 className="text-sm font-semibold text-t-primary mb-3">Net Worth vs Benchmarks (% Change)</h3>

        {/* Summary stats bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          {summaryItems.map((item) => (
            <div
              key={item.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{
                color: item.color,
                backgroundColor: `${item.color}15`,
                border: `1px solid ${item.color}30`,
              }}
            >
              {item.label}: {item.value > 0 ? '+' : ''}{item.value.toFixed(1)}%
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
            <XAxis dataKey="date" fontSize={12} stroke={cc.axis} />
            <YAxis
              domain={[Math.floor(minVal - padding), Math.ceil(maxVal + padding)]}
              tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              fontSize={12}
              stroke={cc.axis}
            />
            <Tooltip
              formatter={(value, name) => {
                const v = Number(value);
                const label =
                  name === 'nw'
                    ? 'Net Worth'
                    : BENCHMARK_CONFIG[name as BenchmarkId]?.label ?? name;
                return [`${v > 0 ? '+' : ''}${v.toFixed(2)}%`, label];
              }}
              labelStyle={{ fontWeight: 600, color: cc.tooltipText }}
              contentStyle={{
                borderRadius: '10px',
                border: `1px solid ${cc.tooltipBorder}`,
                fontSize: '13px',
                backgroundColor: cc.tooltipBg,
                color: cc.tooltipText,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            />
            <Legend
              formatter={(value: string) =>
                value === 'nw' ? 'Net Worth' : BENCHMARK_CONFIG[value as BenchmarkId]?.label ?? value
              }
            />
            <ReferenceLine y={0} stroke={cc.axis} strokeDasharray="3 3" />
            {visibleAnnotations.map((ann) => {
              const formatted = new Date(ann.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const exists = data.some((d) => d.date === formatted);
              if (!exists) return null;
              return (
                <ReferenceLine
                  key={ann.id}
                  x={formatted}
                  stroke={ann.color || 'var(--accent)'}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: ann.label, position: 'top', fontSize: 9, fill: ann.color || 'var(--accent)' }}
                />
              );
            })}
            <Line
              type="monotone"
              dataKey="nw"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            {enabledKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={BENCHMARK_CONFIG[key].color}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── Default: absolute dollar value view ──
  const sortedSnapshots = [...filteredSnapshots].sort((a, b) => a.date.localeCompare(b.date));
  const data = sortedSnapshots.map((s) => ({
    date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: parseFloat((s.netWorthValue ?? s.totalValue).toFixed(2)),
  }));

  const values = data.map((d) => d.value);
  const currentNW = values[values.length - 1] ?? 0;
  const minVal = values.reduce((a, b) => Math.min(a, b), Infinity);
  const rawMax = values.reduce((a, b) => Math.max(a, b), -Infinity);
  const highestMilestone = milestones.length > 0 ? milestones.reduce((a, m) => Math.max(a, m.value), 0) : 0;
  const maxVal = Math.max(rawMax, highestMilestone);
  const range = maxVal - minVal || maxVal * 0.1;
  const padding = range * 0.15;
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(range, 1))));
  const yMin = Math.max(0, Math.floor((minVal - padding) / step) * step);
  const yMax = Math.ceil((maxVal + padding) / step) * step;

  return (
    <div className="bg-surface-card card-radius card-shadow p-5">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Net Worth Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
          <XAxis dataKey="date" fontSize={12} stroke={cc.axis} />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => formatCompactCurrency(v)}
            fontSize={12}
            stroke={cc.axis}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            labelStyle={{ fontWeight: 600, color: cc.tooltipText }}
            contentStyle={{
              borderRadius: '10px',
              border: `1px solid ${cc.tooltipBorder}`,
              fontSize: '13px',
              backgroundColor: cc.tooltipBg,
              color: cc.tooltipText,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
          {visibleAnnotations.map((ann) => {
            const formatted = new Date(ann.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const exists = data.some((d) => d.date === formatted);
            if (!exists) return null;
            return (
              <ReferenceLine
                key={`ann-${ann.id}`}
                x={formatted}
                stroke={ann.color || 'var(--accent)'}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: ann.label, position: 'top', fontSize: 9, fill: ann.color || 'var(--accent)' }}
              />
            );
          })}
          {milestones.map((m) => {
            const reached = currentNW >= m.value;
            return (
              <ReferenceLine
                key={m.id}
                y={m.value}
                stroke={reached ? '#10b981' : '#3b82f6'}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{ value: `${m.name} ${formatCurrency(m.value)}`, position: 'right', fontSize: 10, fill: reached ? '#10b981' : '#3b82f6' }}
              />
            );
          })}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
