import { useState } from 'react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatCurrency, formatPercent } from '../utils/formatters';

type ViewMode = 'monthly' | 'yearly';

interface PeriodSummary {
  label: string;
  startValue: number;
  endValue: number;
  change: number;
  changePercent: number;
}

function formatMonthKey(key: string): string {
  return new Date(key + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function buildSummaries(
  snapshots: { date: string; value: number }[],
  mode: ViewMode
): PeriodSummary[] {
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

  // Group snapshots by period key
  const groups = new Map<string, { date: string; value: number }[]>();
  for (const s of sorted) {
    const key = mode === 'monthly' ? s.date.slice(0, 7) : s.date.slice(0, 4);
    const group = groups.get(key) || [];
    group.push(s);
    groups.set(key, group);
  }

  // Ordered period keys that actually have data
  const keys = Array.from(groups.keys()).sort();

  // Build summaries comparing each period to the previous one
  const summaries: PeriodSummary[] = [];
  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    const currentGroup = groups.get(currentKey)!;
    const endValue = currentGroup[currentGroup.length - 1].value;
    const startValue = i > 0 ? groups.get(keys[i - 1])![groups.get(keys[i - 1])!.length - 1].value : currentGroup[0].value;
    const change = endValue - startValue;
    const changePercent = startValue > 0 ? (change / startValue) * 100 : 0;

    // Build a label that shows the span
    let label: string;
    if (mode === 'yearly') {
      label = currentKey;
    } else {
      const prevKey = i > 0 ? keys[i - 1] : null;
      if (!prevKey) {
        // First period — just show the month
        label = formatMonthKey(currentKey);
      } else {
        // Check if consecutive months
        const [prevY, prevM] = prevKey.split('-').map(Number);
        const [curY, curM] = currentKey.split('-').map(Number);
        const monthDiff = (curY - prevY) * 12 + (curM - prevM);
        if (monthDiff === 1) {
          // Normal consecutive month
          label = formatMonthKey(currentKey);
        } else {
          // Gap — show span from the month after previous to current
          let spanStartM = prevM + 1;
          let spanStartY = prevY;
          if (spanStartM > 12) { spanStartM = 1; spanStartY++; }
          const spanStartKey = `${spanStartY}-${String(spanStartM).padStart(2, '0')}`;
          label = `${formatMonthKey(spanStartKey)} → ${formatMonthKey(currentKey)}`;
        }
      }
    }

    summaries.push({ label, startValue, endValue, change, changePercent });
  }

  return summaries.reverse();
}

export function MonthlySummary() {
  const { snapshots } = usePortfolioContext();
  const [mode, setMode] = useState<ViewMode>('monthly');

  const data = snapshots.map((s) => ({
    date: s.date,
    value: s.netWorthValue ?? s.totalValue,
  }));

  const summaries = buildSummaries(data, mode);

  if (summaries.length === 0) {
    return (
      <div className="bg-surface-card rounded-xl border border-b-default p-5">
        <h3 className="text-sm font-semibold text-t-primary mb-4">Period Summary</h3>
        <p className="text-sm text-t-muted text-center py-6">
          Need snapshot history to show summaries.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl border border-b-default p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-t-primary">Period Summary</h3>
        <div className="flex bg-surface-alt rounded-lg p-0.5">
          <button
            onClick={() => setMode('monthly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'monthly'
                ? 'bg-surface-card text-t-primary shadow-sm'
                : 'text-t-muted hover:text-t-secondary'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setMode('yearly')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'yearly'
                ? 'bg-surface-card text-t-primary shadow-sm'
                : 'text-t-muted hover:text-t-secondary'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-b-default text-left">
              <th className="pb-2 font-medium text-t-muted text-xs">Period</th>
              <th className="pb-2 font-medium text-t-muted text-xs text-right">Start</th>
              <th className="pb-2 font-medium text-t-muted text-xs text-right">End</th>
              <th className="pb-2 font-medium text-t-muted text-xs text-right">Change</th>
              <th className="pb-2 font-medium text-t-muted text-xs text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.label} className="border-b border-b-subtle last:border-0">
                <td className="py-2 text-t-secondary font-medium">{s.label}</td>
                <td className="py-2 text-right text-t-muted">{formatCurrency(s.startValue)}</td>
                <td className="py-2 text-right text-t-primary font-medium">
                  {formatCurrency(s.endValue)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    s.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {s.change >= 0 ? '+' : ''}
                  {formatCurrency(s.change)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    s.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatPercent(s.changePercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
