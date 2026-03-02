import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import type { PortfolioSnapshot, TimeRange } from '../types';
import { filterByTimeRange } from './NetWorthLineChart';

interface Props {
  snapshots: PortfolioSnapshot[];
  timeRange: TimeRange;
}

export function RollingReturnsChart({ snapshots, timeRange }: Props) {
  const { theme } = usePortfolioContext();
  const colors = getChartColors(theme);

  const data = useMemo(() => {
    const filtered = filterByTimeRange(snapshots, timeRange);
    if (filtered.length < 2) return [];

    // Build date → value map from ALL snapshots so year-ago lookups work
    const dateMap = new Map<string, number>();
    for (const s of snapshots) {
      dateMap.set(s.date, s.netWorthValue ?? s.totalValue);
    }

    const result: { date: string; return1Y: number }[] = [];
    for (const s of filtered) {
      const d = new Date(s.date);
      d.setFullYear(d.getFullYear() - 1);
      const yearAgoStr = d.toISOString().split('T')[0];

      // Find closest snapshot to year-ago date
      let closest: { date: string; value: number } | null = null;
      let minDiff = Infinity;
      for (const [date, value] of dateMap) {
        const diff = Math.abs(new Date(date).getTime() - new Date(yearAgoStr).getTime());
        if (diff < minDiff && diff < 45 * 24 * 60 * 60 * 1000) { // within 45 days
          minDiff = diff;
          closest = { date, value };
        }
      }

      if (closest && closest.value > 0) {
        const ret = (((s.netWorthValue ?? s.totalValue) - closest.value) / closest.value) * 100;
        result.push({
          date: s.date,
          return1Y: Math.round(ret * 100) / 100,
        });
      }
    }
    return result;
  }, [snapshots, timeRange]);

  if (data.length < 2) {
    return (
      <div className="bg-surface-card card-radius card-shadow p-4">
        <h3 className="text-sm font-semibold text-t-primary mb-3">Rolling 1Y Returns</h3>
        <p className="text-xs text-t-faint text-center py-8">Need 1+ year of data.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card card-radius card-shadow p-4">
      <h3 className="text-sm font-semibold text-t-primary mb-3">Rolling 1Y Returns</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: colors.axis }}
            tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short' })}
          />
          <YAxis
            tick={{ fontSize: 10, fill: colors.axis }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ReferenceLine y={0} stroke={colors.refLine} />
          <Tooltip
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: 10,
              fontSize: 12,
              color: colors.tooltipText,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            formatter={(v) => [`${Number(v).toFixed(2)}%`, '1Y Return']}
          />
          <Line
            type="monotone"
            dataKey="return1Y"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
