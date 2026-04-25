import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';

interface LedgerDivergenceBannerProps {
  onOpenSettings?: () => void;
}

/**
 * Phase 3 parallel-run banner. Surfaces a non-blocking warning when the
 * transaction ledger disagrees with stored holding shares/cost basis by
 * more than the validator's tolerance ($0.01 cost-basis or 1e-6 shares).
 *
 * Dismissable for the current session only — reload re-shows it. The
 * intent is "you'll see this every cold start until ledger and storage
 * agree", not "click X and forget about it forever". The banner is the
 * pre-flip safety belt.
 */
export function LedgerDivergenceBanner({ onOpenSettings }: LedgerDivergenceBannerProps) {
  const { ledgerDivergences } = usePortfolioContext();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ledger-divergence-dismissed') === 'true';
    } catch {
      return false;
    }
  });

  if (ledgerDivergences.length === 0 || dismissed) return null;

  function handleDismiss() {
    try {
      sessionStorage.setItem('ledger-divergence-dismissed', 'true');
    } catch {
      // sessionStorage may be unavailable in private mode — fall back
      // to in-memory state only.
    }
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-4 sm:px-6 py-2"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>{ledgerDivergences.length}</strong>{' '}
            holding{ledgerDivergences.length === 1 ? '' : 's'} disagree between
            transaction ledger and stored cost basis.
            {onOpenSettings && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="underline font-medium hover:opacity-80"
                >
                  Review in Settings
                </button>
                .
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
          aria-label="Dismiss for this session"
          title="Dismiss for this session"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
