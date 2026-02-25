import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import type { PortfolioSnapshot } from '../types';
import { formatCurrency } from '../utils/formatters';

interface PortfolioLineChartProps {
  snapshots: PortfolioSnapshot[];
}

export function PortfolioLineChart({ snapshots }: PortfolioLineChartProps) {
  const { theme } = usePortfolioContext();
  const cc = getChartColors(theme);
  const withPortfolio = snapshots.filter((s) => s.portfolioValue != null);

  if (withPortfolio.length < 2) {
    return (
      <div className="bg-surface-card rounded-xl border border-b-default p-5">
        <h3 className="text-sm font-semibold text-t-primary mb-4">Portfolio Value Over Time</h3>
        <div className="flex items-center justify-center h-[260px] text-sm text-t-muted">
          Portfolio history will appear after 2+ days of snapshots.
        </div>
      </div>
    );
  }

  const data = withPortfolio.map((s) => ({
    date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: parseFloat((s.portfolioValue!).toFixed(2)),
  }));

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || maxVal * 0.1;
  const padding = range * 0.15;
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(range, 1))));
  const yMin = Math.max(0, Math.floor((minVal - padding) / step) * step);
  const yMax = Math.ceil((maxVal + padding) / step) * step;

  return (
    <div className="bg-surface-card rounded-xl border border-b-default p-5">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Portfolio Value Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
          <XAxis dataKey="date" fontSize={12} stroke={cc.axis} />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            fontSize={12}
            stroke={cc.axis}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            labelStyle={{ fontWeight: 600, color: cc.tooltipText }}
            contentStyle={{
              borderRadius: '8px',
              border: `1px solid ${cc.tooltipBorder}`,
              fontSize: '13px',
              backgroundColor: cc.tooltipBg,
              color: cc.tooltipText,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
