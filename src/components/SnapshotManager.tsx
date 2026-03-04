import { useState } from 'react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatCurrency, formatDate, todayDateString } from '../utils/formatters';

export function SnapshotManager() {
  const { snapshots, addManualSnapshot, deleteSnapshot } = usePortfolioContext();
  const [showForm, setShowForm] = useState(false);
  // Bug 24: use index instead of date string to avoid ambiguity with same-date snapshots
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [netWorth, setNetWorth] = useState('');
  const [portfolioValue, setPortfolioValue] = useState('');

  const sortedSnapshots = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  const resetForm = () => {
    setDate('');
    setSnapshotName('');
    setNetWorth('');
    setPortfolioValue('');
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nw = parseFloat(netWorth);
    if (!date || isNaN(nw) || nw < 0) return;
    const pv = portfolioValue.trim() === '' ? undefined : parseFloat(portfolioValue);
    if (pv !== undefined && (isNaN(pv) || pv < 0)) return;
    const trimmedName = snapshotName.trim() || undefined;
    addManualSnapshot(date, nw, pv, trimmedName);
    resetForm();
  };

  return (
    <div className="bg-surface-card card-radius border border-b-default p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-t-primary">Snapshot History</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <Plus size={14} />
            Add Entry
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 rounded-lg bg-surface border border-b-default">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Date</label>
              <input
                type="date"
                value={date}
                max={todayDateString()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-b-input px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Label</label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Year-end, Bonus"
                className="w-full rounded-md border border-b-input px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Net Worth ($)</label>
              <input
                type="number"
                value={netWorth}
                onChange={(e) => setNetWorth(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full rounded-md border border-b-input px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Portfolio Value ($)</label>
              <input
                type="number"
                value={portfolioValue}
                onChange={(e) => setPortfolioValue(e.target.value)}
                placeholder="Optional"
                min="0"
                step="0.01"
                className="w-full rounded-md border border-b-input px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              <Check size={13} />
              Save
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1.5 rounded-md bg-surface-active px-3 py-1.5 text-xs font-medium text-t-secondary hover:bg-surface-hover transition-colors"
            >
              <X size={13} />
              Cancel
            </button>
          </div>
        </form>
      )}

      {sortedSnapshots.length === 0 ? (
        <p className="text-sm text-t-muted text-center py-6">No snapshots yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default text-left">
                <th className="pb-2 font-medium text-t-muted text-xs">Date</th>
                <th className="pb-2 font-medium text-t-muted text-xs">Label</th>
                <th className="pb-2 font-medium text-t-muted text-xs text-right">Net Worth</th>
                <th className="pb-2 font-medium text-t-muted text-xs text-right">Portfolio Value</th>
                <th className="pb-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sortedSnapshots.map((s, i) => (
                <tr key={`${s.date}-${i}`} className="border-b border-b-subtle last:border-0">
                  <td className="py-2 text-t-secondary">{formatDate(s.date)}</td>
                  <td className="py-2 text-t-muted text-xs">{s.name || '—'}</td>
                  <td className="py-2 text-right text-t-primary font-medium">
                    {formatCurrency(s.netWorthValue ?? s.totalValue)}
                  </td>
                  <td className="py-2 text-right text-t-secondary">
                    {s.portfolioValue != null ? formatCurrency(s.portfolioValue) : '-'}
                  </td>
                  <td className="py-2 text-right">
                    {confirmDelete === i ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { deleteSnapshot(s.date); setConfirmDelete(null); }}
                          className="text-red-600 hover:text-red-700 p-0.5"
                          title="Confirm delete"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-t-faint hover:text-t-muted p-0.5"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(i)}
                        className="text-t-faint hover:text-red-500 transition-colors p-0.5"
                        title="Delete snapshot"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
