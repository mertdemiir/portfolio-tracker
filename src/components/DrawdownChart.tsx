import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useSettings } from '../context/SettingsContext';
import { getChartColors } from '../hooks/useTheme';
import { formatMonthDay, formatLongDate } from '../utils/dateHelpers';
import type { PortfolioSnapshot, TimeRange } from '../types';
import { filterByTimeRange } from './NetWorthLineChart';

interface Props {
  snapshots: PortfolioSnapshot[];
  timeRange: TimeRange;
}

export function DrawdownChart({ snapshots, timeRange }: Props) {
  const { theme } = useSettings();
  const colors = getChartColors(theme);

  const data = useMemo(() => {
    const filtered = filterByTimeRange(snapshots, timeRange);
    if (filtered.length < 2) return [];

    let ath = 0;
    return filtered.map((s) => {
      const value = s.netWorthValue ?? s.totalValue;
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
      <div className="bg-surface-card card-radius card-shadow p-4">
        <h3 className="text-sm font-semibold text-t-primary mb-3">Drawdown</h3>
        <p className="text-xs text-t-faint text-center py-8">Not enough data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card card-radius card-shadow p-4">
      <h3 className="text-sm font-semibold text-t-primary mb-3">Drawdown from ATH</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: colors.axis }}
            tickFormatter={(d: string) => formatMonthDay(d).split(' ')[0]}
          />
          <YAxis
            tick={{ fontSize: 10, fill: colors.axis }}
            tickFormatter={(v: number) => `${v}%`}
            domain={['dataMin', 0]}
          />
          <Tooltip
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: 10,
              fontSize: 12,
              color: colors.tooltipText,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            labelFormatter={(d) => formatLongDate(String(d))}
            formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Drawdown']}
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
