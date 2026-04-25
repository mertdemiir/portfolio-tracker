import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, X, Check, ArrowUpDown, MessageSquare, Pencil } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { usePricesFx } from '../context/PricesFxContext';
import { formatCurrency, formatSignedCurrency, formatDate } from '../utils/formatters';
import { formatMonthShortYear } from '../utils/dateHelpers';
import { AddTransactionModal } from './AddTransactionModal';
import { UndoToast } from './UndoToast';
import { v4 as uuidv4 } from 'uuid';
import type { Transaction, Holding, TransactionType } from '../types';
import type { NavFilter } from '../App';

type FilterType = 'all' | TransactionType;

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdrawal', label: 'Withdrawal' },
  { id: 'interest', label: 'Interest' },
  { id: 'correction', label: 'Correction' },
];

const TYPE_BADGE_CLASSES: Record<TransactionType, string> = {
  buy: 'bg-emerald-500/10 text-emerald-600',
  sell: 'bg-red-500/10 text-red-600',
  deposit: 'bg-emerald-500/10 text-emerald-700',
  withdrawal: 'bg-amber-500/10 text-amber-700',
  interest: 'bg-blue-500/10 text-blue-600',
  correction: 'bg-slate-500/10 text-slate-700',
};

type SortKey = 'date' | 'ticker' | 'type' | 'total';

interface PendingUndo {
  transaction: Transaction;
  holdingSnapshot: Holding | null;
  holdingAction: 'modified' | 'deleted' | 'created' | 'none';
  createdHoldingId?: string;
}

interface TransactionLogProps {
  initialFilter?: NavFilter | null;
}

export function TransactionLog({ initialFilter }: TransactionLogProps) {
  const { transactions, deleteTransaction, restoreTransaction, holdings, updateHolding, deleteHolding, restoreHolding, realizedPnl } = usePortfolioContext();
  const { convertToBase } = usePricesFx();
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterTicker, setFilterTicker] = useState(initialFilter?.ticker || '');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const pendingUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply filter from cross-page navigation
  useEffect(() => {
    if (initialFilter?.ticker) {
      setFilterTicker(initialFilter.ticker);
    }
  }, [initialFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  // --- Undo-toast deletion flow ---

  function handleDeleteTransaction(t: Transaction) {
    // Finalize any existing pending undo (makes previous deletion permanent)
    if (pendingUndoTimerRef.current) {
      clearTimeout(pendingUndoTimerRef.current);
      pendingUndoTimerRef.current = null;
    }
    setPendingUndo(null);

    // Find matching holding (same logic as before)
    const allMatches = holdings.filter((h) => h.ticker.toUpperCase() === t.ticker.toUpperCase());
    const txnPortfolioId = t.portfolioId;
    const match = allMatches.find((h) => h.portfolioId === txnPortfolioId)
      || allMatches[0]
      || null;

    // Snapshot the holding BEFORE any modifications
    const holdingSnapshot: Holding | null = match ? { ...match } : null;
    let holdingAction: PendingUndo['holdingAction'] = 'none';
    let createdHoldingId: string | undefined;

    if (match) {
      const { id, ...data } = match;
      if (t.type === 'buy') {
        // Undo buy: reduce shares and recalculate cost basis
        const newShares = match.shares - t.shares;
        if (newShares > 0) {
          const remainingBuys = transactions.filter(
            (tx) => tx.id !== t.id && tx.type === 'buy' && tx.ticker.toUpperCase() === t.ticker.toUpperCase()
          );
          let newBuyPrice = match.buyPrice;
          if (remainingBuys.length > 0) {
            const totalCost = remainingBuys.reduce((s, tx) => s + tx.pricePerShare * tx.shares, 0);
            const totalShares = remainingBuys.reduce((s, tx) => s + tx.shares, 0);
            if (totalShares > 0) newBuyPrice = totalCost / totalShares;
          }
          updateHolding(id, { ...data, shares: newShares, buyPrice: newBuyPrice });
          holdingAction = 'modified';
        } else {
          // This buy created the entire holding — remove it
          deleteHolding(id);
          holdingAction = 'deleted';
        }
      } else {
        // Undo sell: restore shares
        updateHolding(id, { ...data, shares: match.shares + t.shares });
        holdingAction = 'modified';
      }
    } else if (t.type === 'sell') {
      // Holding was fully sold and deleted — recreate it
      createdHoldingId = uuidv4();
      restoreHolding({
        id: createdHoldingId,
        ticker: t.ticker,
        name: t.name,
        shares: t.shares,
        buyPrice: t.costBasisPerShare ?? t.pricePerShare,
        buyDate: t.date,
        assetType: t.assetType ?? 'stock',
        inPortfolio: true,
        category: t.category ?? 'investments',
        portfolioId: t.portfolioId,
        ...(t.currency ? { currency: t.currency } : {}),
      });
      holdingAction = 'created';
    }

    deleteTransaction(t.id);
    setConfirmDelete(null);

    // Start 5-second undo window
    const timerId = setTimeout(() => {
      setPendingUndo(null);
      pendingUndoTimerRef.current = null;
    }, 5000);
    pendingUndoTimerRef.current = timerId;

    setPendingUndo({
      transaction: t,
      holdingSnapshot,
      holdingAction,
      createdHoldingId,
    });
  }

  function handleUndo() {
    if (!pendingUndo) return;

    if (pendingUndoTimerRef.current) {
      clearTimeout(pendingUndoTimerRef.current);
      pendingUndoTimerRef.current = null;
    }

    // Restore the transaction with its original ID
    restoreTransaction(pendingUndo.transaction);

    // Restore the holding to its pre-deletion state
    switch (pendingUndo.holdingAction) {
      case 'modified': {
        // Holding was modified (shares reduced for buy-undo, or shares added for sell-undo)
        if (pendingUndo.holdingSnapshot) {
          const { id, ...data } = pendingUndo.holdingSnapshot;
          updateHolding(id, data);
        }
        break;
      }
      case 'deleted': {
        // Holding was fully removed (buy-undo removed entire position)
        if (pendingUndo.holdingSnapshot) {
          restoreHolding(pendingUndo.holdingSnapshot);
        }
        break;
      }
      case 'created': {
        // A new holding was recreated (sell-undo case) — remove it
        if (pendingUndo.createdHoldingId) {
          deleteHolding(pendingUndo.createdHoldingId);
        }
        break;
      }
      // 'none': no holding was affected
    }

    setPendingUndo(null);
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pendingUndoTimerRef.current) {
        clearTimeout(pendingUndoTimerRef.current);
      }
    };
  }, []);

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

  // Bug 5: currency-convert totalBuys/totalSells to base currency
  const totalBuys = transactions.filter((t) => t.type === 'buy').reduce((s, t) => s + convertToBase(t.total, t.currency || 'USD'), 0);
  const totalSells = transactions.filter((t) => t.type === 'sell').reduce((s, t) => s + convertToBase(t.total, t.currency || 'USD'), 0);
  // Bug 4: use context's realizedPnl which is already FX-converted
  const totalRealizedPnl = realizedPnl;

  const SortHeader = ({ label, field, numeric }: { label: string; field: SortKey; numeric?: boolean }) => (
    <th
      className={(numeric ? 'num ' : '') + 'cursor-pointer hover:text-t-primary select-none'}
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
      <div className="m-page-head">
        <div>
          <div className="m-h1">Transactions</div>
          {transactions.length > 0 && (
            <div className="m-sub">
              {transactions.length} entries · {formatCurrency(totalBuys)} bought · {formatCurrency(totalSells)} sold
            </div>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-surface-emph text-t-on-emph rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Log Transaction
        </button>
      </div>

      {/* Monthly volume chart */}
      {transactions.length > 0 && (() => {
        const monthlyData = transactions.reduce((acc, t) => {
          const month = t.date.substring(0, 7); // YYYY-MM
          if (!acc[month]) acc[month] = { month, buys: 0, sells: 0 };
          if (t.type === 'buy') acc[month].buys += t.total;
          else acc[month].sells += t.total;
          return acc;
        }, {} as Record<string, { month: string; buys: number; sells: number }>);

        const chartData = Object.values(monthlyData)
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12)
          .map(d => ({
            ...d,
            // d.month is YYYY-MM; append -01 and format via parseLocalDate so
            // the label doesn't drift into the prior month in negative TZs.
            label: formatMonthShortYear(`${d.month}-01`),
          }));

        if (chartData.length < 2) return null;

        return (
          <div className="bg-surface-card card-radius border border-b-default p-4 mb-6">
            <h3 className="text-xs font-semibold text-t-muted uppercase tracking-wider mb-3">Monthly Activity</h3>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" fontSize={10} stroke="var(--text-faint)" tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value: number | undefined, name?: string) => [formatCurrency(value ?? 0), name === 'buys' ? 'Bought' : 'Sold']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border-default)',
                      fontSize: '12px',
                      backgroundColor: 'var(--surface-card)',
                      color: 'var(--text-primary)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="buys" fill="var(--gain)" radius={[2, 2, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="sells" fill="var(--loss)" radius={[2, 2, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })()}

      {/* Summary cards — Mercury m-kpi-card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="m-kpi-card">
          <div className="m-kpi-label">Total transactions</div>
          <div className="m-kpi-val">{transactions.length}</div>
        </div>
        <div className="m-kpi-card">
          <div className="m-kpi-label">Total bought</div>
          <div className="m-kpi-val pct-up">{formatCurrency(totalBuys)}</div>
        </div>
        <div className="m-kpi-card">
          <div className="m-kpi-label">Total sold</div>
          <div className="m-kpi-val pct-down">{formatCurrency(totalSells)}</div>
        </div>
        <div className="m-kpi-card">
          <div className="m-kpi-label">Realized P&L</div>
          <div className={'m-kpi-val ' + (totalRealizedPnl >= 0 ? 'pct-up' : 'pct-down')}>
            {formatSignedCurrency(totalRealizedPnl)}
          </div>
        </div>
      </div>

      {/* Filters — Mercury m-toolbar */}
      <div className="m-toolbar">
        <div className="m-search">
          <input
            type="text"
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            placeholder="Filter by ticker..."
            aria-label="Filter transactions by ticker"
          />
        </div>
        <div className="mv2-sort-pills">
          {FILTER_OPTIONS.map((opt) => {
            const coreTypes: FilterType[] = ['all', 'buy', 'sell'];
            const hasAny = opt.id === 'all' || transactions.some((t) => t.type === opt.id);
            if (!coreTypes.includes(opt.id) && !hasAny) return null;
            return (
              <button
                key={opt.id}
                onClick={() => setFilterType(opt.id)}
                className={filterType === opt.id ? 'active' : ''}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-card card-radius border border-b-default p-8 text-center">
          <p className="text-sm text-t-muted">
            {transactions.length === 0
              ? 'No transactions yet. Log your first buy or sell.'
              : 'No transactions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="m-table">
              <thead>
                <tr>
                  <SortHeader label="Date" field="date" />
                  <SortHeader label="Type" field="type" />
                  <SortHeader label="Ticker" field="ticker" />
                  <th>Name</th>
                  <th className="num">Shares</th>
                  <th className="num">Price</th>
                  <SortHeader label="Total" field="total" numeric />
                  <th className="num">P&L</th>
                  <th style={{ width: 32 }}></th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <React.Fragment key={t.id}>
                  <tr className="group">
                    <td className="tabular-nums">{formatDate(t.date)}</td>
                    <td>
                      <span
                        className={`m-badge ${TYPE_BADGE_CLASSES[t.type]}`}
                        style={{
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          borderColor: 'transparent',
                        }}
                      >
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.ticker}</td>
                    <td className="text-xs truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>{t.name}</td>
                    <td className="num">{t.shares}</td>
                    <td className="num">{formatCurrency(t.pricePerShare)}</td>
                    <td className="num font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(t.total)}</td>
                    <td className="num">
                      {t.type === 'sell' && t.costBasisPerShare !== undefined ? (
                        <span className={`font-medium ${(t.pricePerShare - t.costBasisPerShare) >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {formatSignedCurrency((t.pricePerShare - t.costBasisPerShare) * t.shares)}
                        </span>
                      ) : (
                        <span className="text-t-faint">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {t.notes && (
                        <button
                          onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                          className="p-1 text-t-faint hover:text-accent transition-colors"
                          title="View note"
                          aria-label="View note"
                          aria-expanded={expandedRow === t.id}
                        >
                          <MessageSquare size={13} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                    <td className="text-right">
                      {confirmDelete === t.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleDeleteTransaction(t)}
                            className="text-loss hover:text-loss/80 p-0.5"
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
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingTransaction(t)}
                            className="text-t-faint hover:text-accent transition-colors p-0.5"
                            title="Edit transaction"
                            aria-label="Edit transaction"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(t.id)}
                            className="text-t-faint hover:text-loss transition-colors p-0.5"
                            title="Delete transaction"
                            aria-label="Delete transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedRow === t.id && t.notes && (
                    <tr>
                      <td colSpan={10} className="px-5 py-3 bg-surface-alt/30">
                        <div className="flex items-start gap-2 border-l-2 border-accent/40 pl-3">
                          <p className="text-xs text-t-secondary leading-relaxed">{t.notes}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
      )}

      {pendingUndo && (
        <UndoToast
          message="Transaction deleted"
          onUndo={handleUndo}
          onDismiss={() => setPendingUndo(null)}
        />
      )}

      {showModal && <AddTransactionModal onClose={() => setShowModal(false)} />}

      {editingTransaction && (
        <AddTransactionModal
          editingTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
}
