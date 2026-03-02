import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Settings2 } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { getChartColors } from '../hooks/useTheme';
import { AllocationTargetEditor } from './AllocationTargetEditor';

export function AllocationTargetChart() {
  const { netWorthSummary, targetAllocations, allCategories, theme } = usePortfolioContext();
  const cc = getChartColors(theme);
  const [showEditor, setShowEditor] = useState(false);

  if (targetAllocations.length === 0) {
    return (
      <div className="bg-surface-card card-radius card-shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-t-primary">Allocation vs Targets</h3>
          <button
            onClick={() => setShowEditor(true)}
            className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            <Settings2 size={14} />
            Set Targets
          </button>
        </div>
        <p className="text-sm text-t-muted text-center py-6">
          Set target allocations to compare against your actual distribution.
        </p>
        {showEditor && <AllocationTargetEditor onClose={() => setShowEditor(false)} />}
      </div>
    );
  }

  const data = allCategories
    .map((cat) => {
      const actual = netWorthSummary.categoryBreakdown.find((c) => c.key === cat.key);
      const target = targetAllocations.find((t) => t.categoryKey === cat.key);
      if (!actual && !target) return null;
      const actualPct = actual ? Math.round(actual.percentage * 10) / 10 : 0;
      const targetPct = target ? target.targetPercent : 0;
      return {
        name: cat.label,
        actual: actualPct,
        target: targetPct,
        deviation: Math.round((actualPct - targetPct) * 10) / 10,
      };
    })
    .filter(Boolean) as { name: string; actual: number; target: number; deviation: number }[];

  return (
    <div className="bg-surface-card card-radius card-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-t-primary">Allocation vs Targets</h3>
        <button
          onClick={() => setShowEditor(true)}
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          <Settings2 size={14} />
          Edit Targets
        </button>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 20 }}>
          <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} fontSize={12} stroke={cc.axis} />
          <YAxis type="category" dataKey="name" width={100} fontSize={12} stroke={cc.axis} />
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(1)}%`}
            contentStyle={{
              borderRadius: '10px',
              border: `1px solid ${cc.tooltipBorder}`,
              fontSize: '13px',
              backgroundColor: cc.tooltipBg,
              color: cc.tooltipText,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
          <Bar dataKey="target" fill={cc.targetBar} radius={[0, 4, 4, 0]} barSize={12} name="target" />
          <Bar dataKey="actual" radius={[0, 4, 4, 0]} barSize={12} name="actual">
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  Math.abs(entry.deviation) <= 2
                    ? '#10b981'
                    : Math.abs(entry.deviation) <= 5
                      ? '#f59e0b'
                      : '#ef4444'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Deviation table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-b-default">
              <th className="pb-1.5 text-left font-medium text-t-muted">Category</th>
              <th className="pb-1.5 text-right font-medium text-t-muted">Actual</th>
              <th className="pb-1.5 text-right font-medium text-t-muted">Target</th>
              <th className="pb-1.5 text-right font-medium text-t-muted">Deviation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name} className="border-b border-b-subtle last:border-0">
                <td className="py-1.5 text-t-secondary">{d.name}</td>
                <td className="py-1.5 text-right text-t-primary">{d.actual.toFixed(1)}%</td>
                <td className="py-1.5 text-right text-t-muted">{d.target.toFixed(1)}%</td>
                <td
                  className={`py-1.5 text-right font-medium ${
                    Math.abs(d.deviation) <= 2
                      ? 'text-green-600'
                      : Math.abs(d.deviation) <= 5
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }`}
                >
                  {d.deviation >= 0 ? '+' : ''}
                  {d.deviation.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditor && <AllocationTargetEditor onClose={() => setShowEditor(false)} />}
    </div>
  );
}
