import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { PortfolioSnapshot } from '../types';
import { formatCurrency } from '../utils/formatters';

interface NetWorthLineChartProps {
  snapshots: PortfolioSnapshot[];
}

export function NetWorthLineChart({ snapshots }: NetWorthLineChartProps) {
  if (snapshots.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Net Worth Over Time</h3>
        <div className="flex items-center justify-center h-[260px] text-sm text-slate-500">
          Net worth history will appear after 2+ days of snapshots.
        </div>
      </div>
    );
  }

  const data = snapshots.map((s) => ({
    date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: parseFloat((s.netWorthValue ?? s.totalValue).toFixed(2)),
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Net Worth Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ left: 10, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
            fontSize={12}
            stroke="#94a3b8"
          />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            labelStyle={{ fontWeight: 600 }}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
