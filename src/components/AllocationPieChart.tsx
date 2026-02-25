import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import type { EnrichedHolding } from '../types';
import { formatCurrency } from '../utils/formatters';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
];

interface AllocationPieChartProps {
  holdings: EnrichedHolding[];
}

export function AllocationPieChart({ holdings }: AllocationPieChartProps) {
  const { theme } = usePortfolioContext();
  const cc = getChartColors(theme);
  const data = holdings.map((h) => ({
    name: h.ticker,
    value: h.marketValue,
    allocation: h.allocation,
  }));

  return (
    <div className="bg-surface-card rounded-xl border border-b-default p-5">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Portfolio Allocation</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrency(value as number)}
            contentStyle={{
              borderRadius: '8px',
              border: `1px solid ${cc.tooltipBorder}`,
              fontSize: '13px',
              backgroundColor: cc.tooltipBg,
              color: cc.tooltipText,
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
