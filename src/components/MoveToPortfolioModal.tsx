import { FolderInput } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { DEFAULT_PORTFOLIO_ID } from '../types';
import type { Holding, Portfolio } from '../types';

interface MoveToPortfolioModalProps {
  holding: Holding;
  onClose: () => void;
}

export function MoveToPortfolioModal({ holding, onClose }: MoveToPortfolioModalProps) {
  const { portfolios, holdings, updateHolding } = usePortfolioContext();

  const currentPortfolioId = holding.portfolioId;

  function handleMove(targetPortfolioId: string) {
    // Look up the original (non-enriched) holding from context
    const original = holdings.find((h) => h.id === holding.id);
    if (!original) return;
    const { id: _id, ...data } = original;
    updateHolding(holding.id, { ...data, portfolioId: targetPortfolioId });
    onClose();
  }

  // Sort portfolios: default first, then alphabetical
  const sortedPortfolios = [...portfolios].sort((a, b) => {
    if (a.id === DEFAULT_PORTFOLIO_ID) return -1;
    if (b.id === DEFAULT_PORTFOLIO_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Modal
      title={
        <span className="flex items-center gap-2 text-sm">
          <FolderInput className="w-4 h-4 text-accent" aria-hidden="true" />
          Move Holding
        </span>
      }
      onClose={onClose}
      size="xs"
    >
      <p className="text-xs text-t-muted mb-3">
        Move <span className="font-semibold text-t-primary">{holding.ticker}</span> to:
      </p>

      <div className="space-y-1.5">
        {sortedPortfolios.map((p: Portfolio) => {
          const isCurrent = p.id === currentPortfolioId;
          return (
            <button
              key={p.id}
              onClick={() => !isCurrent && handleMove(p.id)}
              disabled={isCurrent}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isCurrent
                  ? 'bg-accent/10 text-accent font-medium cursor-default'
                  : 'text-t-secondary hover:bg-surface-alt'
              }`}
            >
              <span>{p.name}</span>
              {isCurrent && <span className="text-[10px] ml-2 text-accent/70">(current)</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="w-full mt-3 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
      >
        Cancel
      </button>
    </Modal>
  );
}
