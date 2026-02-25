import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import type { PortfolioSnapshot, TimeRange } from '../types';
import { filterByTimeRange } from './NetWorthLineChart';

interface Props {
  snapshots: PortfolioSnapshot[];
  timeRange: TimeRange;
}

export function DrawdownChart({ snapshots, timeRange }: Props) {
  const { theme } = usePortfolioContext();
  const colors = getChartColors(theme);

  const data = useMemo(() => {
    const filtered = filterByTimeRange(snapshots, timeRange);
    if (filtered.length < 2) return [];

    let ath = 0;
    return filtered.map((s) => {
      const value = s.netWorthValue;
      if (value > ath) ath = value;
      const drawdown = ath > 0 ? ((value - ath) / ath) * 100 : 0;
      return {
        date: s.date,
        drawdown: Math.round(drawdown * 100) / 100,
      };
    });
  }, [snapshots, timeRange]);

  if (data.length < 2) {
    return (
      <div className="bg-surface-card rounded-xl border border-b-default p-4">
        <h3 className="text-sm font-semibold text-t-primary mb-3">Drawdown</h3>
        <p className="text-xs text-t-faint text-center py-8">Not enough data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl border border-b-default p-4">
      <h3 className="text-sm font-semibold text-t-primary mb-3">Drawdown from ATH</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: colors.axis }}
            tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short' })}
          />
          <YAxis
            tick={{ fontSize: 10, fill: colors.axis }}
            tickFormatter={(v: number) => `${v}%`}
            domain={['dataMin', 0]}
          />
          <Tooltip
            contentStyle={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 8, fontSize: 12, color: colors.tooltipText }}
            labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Drawdown']}
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            fill="#ef444433"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
