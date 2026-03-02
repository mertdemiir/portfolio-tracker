import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import { formatCurrency, formatPercent } from '../utils/formatters';
import type { EnrichedHolding } from '../types';

interface Props {
  holdings: EnrichedHolding[];
}

function getColor(change: number): string {
  if (change > 3) return '#059669';
  if (change > 1) return '#10b981';
  if (change > 0.01) return '#6ee7b7';
  if (change >= -0.01) return '#94a3b8'; // neutral gray for ~0%
  if (change > -1) return '#fca5a5';
  if (change > -3) return '#ef4444';
  return '#dc2626';
}

interface TreemapNodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  change: number;
  value: number;
}

function CustomContent(props: TreemapNodeProps) {
  const { x, y, width, height, name, change } = props;
  if (width < 30 || height < 25) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={getColor(change)} stroke="var(--surface-card)" strokeWidth={2} />
      {width > 45 && height > 35 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={width > 80 ? 12 : 10} fontWeight={600}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}>
            {formatPercent(change)}
          </text>
        </>
      )}
    </g>
  );
}

export function TreemapChart({ holdings }: Props) {
  const { theme } = usePortfolioContext();
  const colors = getChartColors(theme);

  const data = holdings
    .filter((h) => h.marketValue > 0)
    .map((h) => ({
      name: h.ticker,
      size: h.marketValue,
      change: h.dailyChangePercent,
    }))
    .sort((a, b) => b.size - a.size);

  if (data.length === 0) return null;

  return (
    <div className="bg-surface-card card-radius card-shadow p-4">
      <h3 className="text-sm font-semibold text-t-primary mb-3">Portfolio Treemap</h3>
      <ResponsiveContainer width="100%" height={250}>
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          content={<CustomContent x={0} y={0} width={0} height={0} name="" change={0} value={0} />}
        >
          <Tooltip
            content={({ payload }) => {
              if (!payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div
                  className="px-3 py-2 text-xs"
                  style={{
                    background: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    color: colors.tooltipText,
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  <p className="font-semibold">{d.name}</p>
                  <p>{formatCurrency(d.size)}</p>
                  <p style={{ color: d.change >= 0 ? '#10b981' : '#ef4444' }}>{formatPercent(d.change)}</p>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
