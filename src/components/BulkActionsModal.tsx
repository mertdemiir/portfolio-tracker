import { useState } from 'react';
import { FolderInput, Tag, Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_PORTFOLIO_ID } from '../types';
import type { Holding } from '../types';

export type BulkActionMode = 'move' | 'retag' | 'delete';

interface BulkActionsModalProps {
  mode: BulkActionMode;
  holdingIds: string[];
  onClose: () => void;
  onComplete?: () => void;
}

/**
 * Phase 4.3 — bulk actions modal.
 *
 * One component, three modes (Move / Retag / Delete) — picked by the
 * `mode` prop. All three operate on the same `holdingIds` set and
 * dispatch through the existing single-holding update/delete actions
 * (sequential calls, batched by React in the same event handler).
 *
 * Why single component: the three modes share the "you've selected N
 * holdings, here's what happens" framing. Splitting them into 3 files
 * would triplicate the header + count display. The body branches.
 */
export function BulkActionsModal({ mode, holdingIds, onClose, onComplete }: BulkActionsModalProps) {
  const { portfolios, holdings, updateHolding, deleteHolding } = usePortfolioContext();
  const { allCategories } = useSettings();

  const targets: Holding[] = holdings.filter((h) => holdingIds.includes(h.id));

  const [targetPortfolioId, setTargetPortfolioId] = useState<string | null>(null);
  const [targetCategoryKey, setTargetCategoryKey] = useState<string | null>(null);

  function applyMove(portfolioId: string) {
    for (const h of targets) {
      if (h.portfolioId === portfolioId) continue;
      const { id: _id, ...data } = h;
      updateHolding(h.id, { ...data, portfolioId });
    }
    onComplete?.();
    onClose();
  }

  function applyRetag(categoryKey: string) {
    for (const h of targets) {
      if (h.category === categoryKey) continue;
      const { id: _id, ...data } = h;
      updateHolding(h.id, { ...data, category: categoryKey });
    }
    onComplete?.();
    onClose();
  }

  function applyDelete() {
    for (const h of targets) {
      deleteHolding(h.id);
    }
    onComplete?.();
    onClose();
  }

  const sortedPortfolios = [...portfolios].sort((a, b) => {
    if (a.id === DEFAULT_PORTFOLIO_ID) return -1;
    if (b.id === DEFAULT_PORTFOLIO_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  const titleByMode: Record<BulkActionMode, React.ReactNode> = {
    move: (
      <span className="flex items-center gap-2 text-sm">
        <FolderInput className="w-4 h-4 text-accent" aria-hidden="true" />
        Move {targets.length} holding{targets.length === 1 ? '' : 's'}
      </span>
    ),
    retag: (
      <span className="flex items-center gap-2 text-sm">
        <Tag className="w-4 h-4 text-accent" aria-hidden="true" />
        Retag {targets.length} holding{targets.length === 1 ? '' : 's'}
      </span>
    ),
    delete: (
      <span className="flex items-center gap-2 text-sm">
        <Trash2 className="w-4 h-4 text-loss" aria-hidden="true" />
        Delete {targets.length} holding{targets.length === 1 ? '' : 's'}
      </span>
    ),
  };

  return (
    <Modal title={titleByMode[mode]} onClose={onClose} size={mode === 'delete' ? 'sm' : 'xs'}>
      {/* Selected tickers preview (max 8 visible) */}
      <div className="mb-3 px-3 py-2 bg-surface-alt rounded-lg text-xs text-t-secondary">
        <span className="font-semibold mr-1">Selected:</span>
        {targets.slice(0, 8).map((h, i) => (
          <span key={h.id} className="font-mono">
            {h.ticker}
            {i < Math.min(targets.length, 8) - 1 ? ', ' : ''}
          </span>
        ))}
        {targets.length > 8 && <span className="text-t-faint"> +{targets.length - 8} more</span>}
      </div>

      {mode === 'move' && (
        <>
          <p className="text-xs text-t-muted mb-2">Move these holdings to which portfolio?</p>
          <div className="space-y-1.5">
            {sortedPortfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setTargetPortfolioId(p.id);
                  applyMove(p.id);
                }}
                disabled={targetPortfolioId !== null}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-t-secondary hover:bg-surface-alt transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'retag' && (
        <>
          <p className="text-xs text-t-muted mb-2">Reassign these holdings to which category?</p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {allCategories.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setTargetCategoryKey(c.key);
                  applyRetag(c.key);
                }}
                disabled={targetCategoryKey !== null}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-t-secondary hover:bg-surface-alt transition-colors"
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'delete' && (
        <>
          <div className="mb-3 px-3 py-2 bg-loss-bg/40 border border-loss/30 rounded-lg text-xs text-loss flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              This permanently removes these holdings from your portfolio. Their transaction history
              stays intact in the ledger and can be referenced from the Transactions tab.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applyDelete}
              className="px-3 py-2 bg-loss text-white rounded-lg text-sm font-medium hover:bg-loss/90 transition-colors"
            >
              Delete {targets.length}
            </button>
          </div>
        </>
      )}

      {(mode === 'move' || mode === 'retag') && (
        <button
          onClick={onClose}
          className="w-full mt-3 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
        >
          Cancel
        </button>
      )}
    </Modal>
  );
}
