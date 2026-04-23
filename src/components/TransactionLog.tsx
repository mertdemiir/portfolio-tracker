import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, X, Check, ArrowUpDown, MessageSquare } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useFxRates } from '../hooks/useFxRates';
import { formatCurrency, formatSignedCurrency, formatDate } from '../utils/formatters';
import { formatMonthShortYear } from '../utils/dateHelpers';
import { AddTransactionModal } from './AddTransactionModal';
import { UndoToast } from './UndoToast';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_PORTFOLIO_ID } from '../types';
import type { Transaction, Holding } from '../types';
import type { NavFilter } from '../App';

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
  const { transactions, deleteTransaction, restoreTransaction, holdings, updateHolding, deleteHolding, restoreHolding, realizedPnl, baseCurrency } = usePortfolioContext();
  const { convertToBase } = useFxRates(baseCurrency);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
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
    const txnPortfolioId = t.portfolioId || DEFAULT_PORTFOLIO_ID;
    const match = allMatches.find((h) => (h.portfolioId || DEFAULT_PORTFOLIO_ID) === txnPortfolioId)
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
        ...(t.currency ? { currency: t.currency } : {}),
        ...(t.portfolioId ? { portfolioId: t.portfolioId } : {}),
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

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider cursor-pointer hover:text-t-secondary select-none"
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-t-primary tracking-tight">Transactions</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover shadow-sm transition-colors"
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-card card-radius border border-b-default p-4 hover:shadow-sm transition-all duration-200">
          <p className="text-xs text-t-muted mb-1">Total Transactions</p>
          <p className="text-xl font-bold text-t-primary tabular-nums">{transactions.length}</p>
        </div>
        <div className="bg-surface-card card-radius border border-b-default border-l-4 border-l-gain p-4 hover:shadow-sm transition-all duration-200">
          <p className="text-xs text-t-muted mb-1">Total Bought</p>
          <p className="text-xl font-bold text-gain tabular-nums">{formatCurrency(totalBuys)}</p>
        </div>
        <div className="bg-surface-card card-radius border border-b-default border-l-4 border-l-loss p-4 hover:shadow-sm transition-all duration-200">
          <p className="text-xs text-t-muted mb-1">Total Sold</p>
          <p className="text-xl font-bold text-loss tabular-nums">{formatCurrency(totalSells)}</p>
        </div>
        <div className={`bg-surface-card card-radius border border-b-default border-l-4 ${totalRealizedPnl >= 0 ? 'border-l-gain' : 'border-l-loss'} p-4 hover:shadow-sm transition-all duration-200`}>
          <p className="text-xs text-t-muted mb-1">Realized P&L</p>
          <p className={`text-xl font-bold tabular-nums ${totalRealizedPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
            {formatSignedCurrency(totalRealizedPnl)}
          </p>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-surface-card card-radius border border-b-default overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-5 pb-4">
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
            className="px-3 py-1.5 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent w-48"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-t-muted text-center py-8 px-5">
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
                  <th className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider">Name</th>
                  <th className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Shares</th>
                  <th className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">Price</th>
                  <SortHeader label="Total" field="total" />
                  <th className="pb-2 text-[11px] font-semibold text-t-muted uppercase tracking-wider text-right">P&L</th>
                  <th className="pb-2 w-8"></th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <React.Fragment key={t.id}>
                  <tr className="border-b border-b-subtle last:border-0 hover:bg-surface-alt/50 transition-colors group">
                    <td className="py-2 text-t-secondary tabular-nums">{formatDate(t.date)}</td>
                    <td className="py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          t.type === 'buy'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {t.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 font-medium text-t-primary">{t.ticker}</td>
                    <td className="py-2 text-t-muted text-xs truncate max-w-[120px]">{t.name}</td>
                    <td className="py-2 text-right text-t-secondary tabular-nums">{t.shares}</td>
                    <td className="py-2 text-right text-t-secondary tabular-nums">{formatCurrency(t.pricePerShare)}</td>
                    <td className="py-2 text-right font-medium text-t-primary tabular-nums">{formatCurrency(t.total)}</td>
                    <td className="py-2 text-right text-sm">
                      {t.type === 'sell' && t.costBasisPerShare !== undefined ? (
                        <span className={`font-medium tabular-nums ${(t.pricePerShare - t.costBasisPerShare) >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {formatSignedCurrency((t.pricePerShare - t.costBasisPerShare) * t.shares)}
                        </span>
                      ) : (
                        <span className="text-t-faint">-</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
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
                    <td className="py-2 text-right">
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
                        <button
                          onClick={() => setConfirmDelete(t.id)}
                          className="text-t-faint hover:text-loss transition-colors p-0.5"
                        >
                          <Trash2 size={14} />
                        </button>
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
      </div>

      {pendingUndo && (
        <UndoToast
          message="Transaction deleted"
          onUndo={handleUndo}
          onDismiss={() => setPendingUndo(null)}
        />
      )}

      {showModal && <AddTransactionModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
