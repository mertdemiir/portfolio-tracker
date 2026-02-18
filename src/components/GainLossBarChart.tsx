import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { EnrichedHolding } from '../types';
import { formatCurrency } from '../utils/formatters';

interface GainLossBarChartProps {
  holdings: EnrichedHolding[];
}

export function GainLossBarChart({ holdings }: GainLossBarChartProps) {
  const data = [...holdings]
    .sort((a, b) => b.gainLoss - a.gainLoss)
    .map((h) => ({
      name: h.ticker,
      gainLoss: parseFloat(h.gainLoss.toFixed(2)),
      percent: h.gainLossPercent,
    }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Gain/Loss by Holding</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => `$${v}`}
            fontSize={12}
            stroke="#94a3b8"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={50}
            fontSize={12}
            stroke="#94a3b8"
          />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
            }}
          />
          <ReferenceLine x={0} stroke="#e2e8f0" />
          <Bar dataKey="gainLoss" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.gainLoss >= 0 ? '#10b981' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
