import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/formatters';
import { LIABILITY_CATEGORIES } from '../types';
import { AddEditLiabilityModal } from './AddEditLiabilityModal';
import type { Liability } from '../types';

interface LiabilitiesSectionProps {
  showTRY: boolean;
  tryRate: number | null;
}

export function LiabilitiesSection({ showTRY, tryRate }: LiabilitiesSectionProps) {
  const { liabilities, deleteLiability, netWorthSummary } = usePortfolioContext();
  const [expanded, setExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);

  function getCategoryInfo(key: string) {
    return LIABILITY_CATEGORIES.find((c) => c.key === key) || { label: key, icon: '📋' };
  }

  function formatValue(value: number): string {
    if (showTRY && tryRate) {
      return `₺${(value * tryRate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return formatCurrency(value);
  }

  // Group by category
  const grouped = liabilities.reduce<Record<string, Liability[]>>((acc, l) => {
    const cat = l.category || 'other-liability';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(l);
    return acc;
  }, {});

  return (
    <div className="mt-4 pt-4 border-t border-b-subtle">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-t-faint group-hover:text-t-muted transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-t-faint group-hover:text-t-muted transition-colors" />
          )}
          <CreditCard className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium text-t-secondary">Liabilities</span>
          {netWorthSummary.totalLiabilities > 0 && (
            <span className="text-xs font-medium text-red-500 ml-1">
              {formatValue(netWorthSummary.totalLiabilities)}
            </span>
          )}
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
        >
          <Plus size={13} />
          Add
        </button>
      </div>

      {expanded && (
        <>
          {liabilities.length === 0 ? (
            <p className="text-xs text-t-faint">No liabilities tracked. Add one to see true net worth.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).map(([catKey, items]) => {
                const catInfo = getCategoryInfo(catKey);
                return (
                  <div key={catKey}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs">{catInfo.icon}</span>
                      <span className="text-xs font-medium text-t-muted">{catInfo.label}</span>
                    </div>
                    <div className="space-y-1.5 ml-5">
                      {items.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-t-primary truncate">{l.name}</span>
                              {l.interestRate !== undefined && (
                                <span className="text-[10px] text-t-faint">{l.interestRate}% APR</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-red-500">
                              {formatValue(l.balance)}
                            </span>
                            <button
                              onClick={() => setEditingLiability(l)}
                              className="p-0.5 text-t-faint hover:text-t-muted opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteLiability(l.id)}
                              className="p-0.5 text-t-faint hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showAddModal && (
        <AddEditLiabilityModal onClose={() => setShowAddModal(false)} />
      )}
      {editingLiability && (
        <AddEditLiabilityModal
          liability={editingLiability}
          onClose={() => setEditingLiability(null)}
        />
      )}
    </div>
  );
}
