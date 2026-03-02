import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import type { EnrichedHolding } from '../types';
import { formatCurrency } from '../utils/formatters';

interface GainLossBarChartProps {
  holdings: EnrichedHolding[];
}

export function GainLossBarChart({ holdings }: GainLossBarChartProps) {
  const { theme } = usePortfolioContext();
  const cc = getChartColors(theme);
  const data = [...holdings]
    .sort((a, b) => b.gainLoss - a.gainLoss)
    .map((h) => ({
      name: h.ticker,
      gainLoss: Math.round(h.gainLoss * 100) / 100,
      percent: h.gainLossPercent,
    }));

  return (
    <div className="bg-surface-card card-radius card-shadow p-5">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Gain/Loss by Holding</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis
            type="number"
            tickFormatter={(v) => `$${v}`}
            fontSize={12}
            stroke={cc.axis}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={50}
            fontSize={12}
            stroke={cc.axis}
          />
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              borderRadius: '10px',
              border: `1px solid ${cc.tooltipBorder}`,
              fontSize: '13px',
              backgroundColor: cc.tooltipBg,
              color: cc.tooltipText,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
          <ReferenceLine x={0} stroke={cc.refLine} />
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
