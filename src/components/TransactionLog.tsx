import { useState, useMemo } from 'react';
import { Plus, Trash2, X, Check, ArrowUpDown } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AddTransactionModal } from './AddTransactionModal';
type SortKey = 'date' | 'ticker' | 'type' | 'total';

export function TransactionLog() {
  const { transactions, deleteTransaction, holdings, updateHolding, addHolding } = usePortfolioContext();
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [filterTicker, setFilterTicker] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (filterType !== 'all') {
      list = list.filter((t) => t.type === filterType);
    }
    if (filterTicker.trim()) {
      const q = filterTicker.trim().toLowerCase();
      list = list.filter(
        (t) => t.ticker.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = a.date.localeCompare(b.date);
          break;
        case 'ticker':
          cmp = a.ticker.localeCompare(b.ticker);
          break;
        case 'type':
          cmp = a.type.localeCompare(b.type);
          break;
        case 'total':
          cmp = a.total - b.total;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [transactions, filterType, filterTicker, sortKey, sortAsc]);

  const totalBuys = transactions.filter((t) => t.type === 'buy').reduce((s, t) => s + t.total, 0);
  const totalSells = transactions.filter((t) => t.type === 'sell').reduce((s, t) => s + t.total, 0);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="pb-2 font-medium text-t-muted text-xs cursor-pointer hover:text-t-secondary select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && <ArrowUpDown size={10} />}
      </span>
    </th>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-t-primary">Transactions</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Log Transaction
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-surface-card rounded-xl border border-b-default p-4">
          <p className="text-xs text-t-muted mb-1">Total Transactions</p>
          <p className="text-xl font-bold text-t-primary">{transactions.length}</p>
        </div>
        <div className="bg-surface-card rounded-xl border border-b-default p-4">
          <p className="text-xs text-t-muted mb-1">Total Bought</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalBuys)}</p>
        </div>
        <div className="bg-surface-card rounded-xl border border-b-default p-4">
          <p className="text-xs text-t-muted mb-1">Total Sold</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalSells)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-card rounded-xl border border-b-default p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex bg-surface-alt rounded-lg p-0.5">
            {(['all', 'buy', 'sell'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                  filterType === t
                    ? 'bg-surface-card text-t-primary shadow-sm'
                    : 'text-t-muted hover:text-t-secondary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            placeholder="Filter by ticker..."
            className="px-3 py-1.5 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-t-muted text-center py-8">
            {transactions.length === 0
              ? 'No transactions yet. Log your first buy or sell.'
              : 'No transactions match your filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-b-default text-left">
                  <SortHeader label="Date" field="date" />
                  <SortHeader label="Type" field="type" />
                  <SortHeader label="Ticker" field="ticker" />
                  <th className="pb-2 font-medium text-t-muted text-xs">Name</th>
                  <th className="pb-2 font-medium text-t-muted text-xs text-right">Shares</th>
                  <th className="pb-2 font-medium text-t-muted text-xs text-right">Price</th>
                  <SortHeader label="Total" field="total" />
                  <th className="pb-2 font-medium text-t-muted text-xs">Notes</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-b-subtle last:border-0">
                    <td className="py-2 text-t-secondary">{formatDate(t.date)}</td>
                    <td className="py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          t.type === 'buy'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 font-medium text-t-primary">{t.ticker}</td>
                    <td className="py-2 text-t-muted text-xs truncate max-w-[120px]">{t.name}</td>
                    <td className="py-2 text-right text-t-secondary">{t.shares}</td>
                    <td className="py-2 text-right text-t-secondary">{formatCurrency(t.pricePerShare)}</td>
                    <td className="py-2 text-right font-medium text-t-primary">{formatCurrency(t.total)}</td>
                    <td className="py-2 text-t-muted text-xs truncate max-w-[100px]">{t.notes || '-'}</td>
                    <td className="py-2 text-right">
                      {confirmDelete === t.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => {
                              // Reverse the holding effect before deleting
                              const match = holdings.find((h) => h.ticker.toUpperCase() === t.ticker.toUpperCase());
                              if (match) {
                                const { id, ...data } = match;
                                if (t.type === 'buy') {
                                  // Undo buy: reduce shares, recalculate cost basis
                                  const newShares = match.shares - t.shares;
                                  if (newShares > 0) {
                                    const newCost = match.shares * match.buyPrice - t.shares * t.pricePerShare;
                                    updateHolding(id, { ...data, shares: newShares, buyPrice: newCost / newShares });
                                  }
                                  // If newShares <= 0, the buy created this holding entirely — just let it stay
                                } else {
                                  // Undo sell: restore shares
                                  updateHolding(id, { ...data, shares: match.shares + t.shares });
                                }
                              } else if (t.type === 'sell') {
                                // Holding was fully sold and deleted — recreate it
                                addHolding({
                                  ticker: t.ticker,
                                  name: t.name,
                                  shares: t.shares,
                                  buyPrice: t.pricePerShare,
                                  buyDate: t.date,
                                  assetType: 'custom',
                                  inPortfolio: true,
                                  category: 'other',
                                });
                              }
                              deleteTransaction(t.id);
                              setConfirmDelete(null);
                            }}
                            className="text-red-600 hover:text-red-700 p-0.5"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-t-faint hover:text-t-muted p-0.5"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          className="text-t-faint hover:text-red-500 transition-colors p-0.5"
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

      {showModal && <AddTransactionModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
