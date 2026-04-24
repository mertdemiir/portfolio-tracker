import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSettings } from '../context/SettingsContext';
import { getChartColors, getChartPalette } from '../hooks/useTheme';
import type { EnrichedHolding } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AllocationPieChartProps {
  holdings: EnrichedHolding[];
}

export function AllocationPieChart({ holdings }: AllocationPieChartProps) {
  const { theme } = useSettings();
  const cc = getChartColors(theme);
  const COLORS = getChartPalette(theme);
  const data = holdings.map((h) => ({
    name: h.ticker,
    value: h.marketValue,
    allocation: h.allocation,
  }));

  return (
    <div className="bg-surface-card card-radius card-shadow p-5">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Portfolio Allocation</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            animationDuration={800}
          >
            {data.map((_entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
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
          <Legend
            formatter={(value: string) => {
              const item = data.find((d) => d.name === value);
              return `${value} (${item?.allocation.toFixed(1)}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
