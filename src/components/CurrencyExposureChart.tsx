import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import { formatCurrency } from '../utils/formatters';
import type { EnrichedHolding } from '../types';

const CURRENCY_COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444',
  '#14b8a6', '#ec4899', '#6366f1', '#eab308', '#06b6d4',
  '#84cc16', '#f43f5e',
];

interface Props {
  holdings: EnrichedHolding[];
}

export function CurrencyExposureChart({ holdings }: Props) {
  const { theme } = usePortfolioContext();
  const colors = getChartColors(theme);

  const data = useMemo(() => {
    if (holdings.length === 0) return [];

    const currencyMap = new Map<string, number>();
    for (const h of holdings) {
      const cur = h.currency || 'USD';
      currencyMap.set(cur, (currencyMap.get(cur) || 0) + h.marketValue);
    }

    const total = Array.from(currencyMap.values()).reduce((a, b) => a + b, 0);
    if (total <= 0) return [];

    return Array.from(currencyMap.entries())
      .map(([currency, value]) => ({
        currency,
        value,
        percentage: (value / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  if (data.length === 0) {
    return (
      <div className="bg-surface-card rounded-xl border border-b-default p-5">
        <h3 className="text-sm font-semibold text-t-primary mb-4">Currency Exposure</h3>
        <div className="flex items-center justify-center h-[200px] text-sm text-t-muted">
          No holdings to analyze.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl border border-b-default p-5">
      <h3 className="text-sm font-semibold text-t-primary mb-4">Currency Exposure</h3>
      <div className="flex items-center gap-4">
        <div className="w-1/2">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                nameKey="currency"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CURRENCY_COLORS[i % CURRENCY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: colors.tooltipText,
                }}
                formatter={(value: number | undefined, name?: string) => [
                  formatCurrency(value ?? 0),
                  name ?? '',
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-1/2 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.currency} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CURRENCY_COLORS[i % CURRENCY_COLORS.length] }}
                />
                <span className="text-sm font-medium text-t-primary">{d.currency}</span>
              </div>
              <span className="text-sm text-t-muted">{d.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
