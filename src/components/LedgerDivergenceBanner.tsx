import { useState } from 'react';
import { Info, AlertTriangle, X } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';

interface LedgerDivergenceBannerProps {
  onOpenSettings?: () => void;
}

/**
 * Phase 3 parallel-run banner. Surfaces a non-blocking notice when the
 * transaction ledger disagrees with stored holding shares/cost basis by
 * more than the validator's tolerance.
 *
 * Tone depends on the source-of-truth flag:
 *
 *   Flag OFF (default): the displayed numbers are storage values and are
 *   unaffected by the divergence. The banner is *informational* — a heads-up
 *   that the ledger derivation doesn't yet agree, so the user knows not to
 *   flip the flag yet. Blue, neutral language ("notice").
 *
 *   Flag ON: the displayed numbers are derived from the ledger, so a
 *   divergence implies the user is looking at potentially different numbers
 *   than they were before the flip. Amber, more emphatic language
 *   ("warning") with a stronger nudge to review.
 *
 * Dismissable for the current session only — reload re-shows it. We don't
 * persist dismissal because the divergence list can change between runs
 * and the user benefits from re-noticing.
 */
export function LedgerDivergenceBanner({ onOpenSettings }: LedgerDivergenceBannerProps) {
  const { ledgerDivergences } = usePortfolioContext();
  const { useTxnSourceOfTruth } = useSettings();
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

  const flagOn = useTxnSourceOfTruth;
  // When the flag is OFF, this is informational — frame it neutrally.
  // When it's ON, this is genuinely actionable — frame it as a warning.
  const Icon = flagOn ? AlertTriangle : Info;
  const containerClass = flagOn
    ? 'bg-amber-500/10 border-b border-amber-500/30 text-amber-800 dark:text-amber-200'
    : 'bg-blue-500/10 border-b border-blue-500/30 text-blue-800 dark:text-blue-200';
  const dismissHoverClass = flagOn ? 'hover:bg-amber-500/20' : 'hover:bg-blue-500/20';
  const count = ledgerDivergences.length;
  const noun = count === 1 ? 'holding' : 'holdings';

  return (
    <div role="status" className={`${containerClass} px-4 sm:px-6 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>
            {flagOn ? (
              <>
                <strong>{count}</strong> {noun} disagree between transaction ledger and stored cost basis.
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
              </>
            ) : (
              <>
                Heads-up: the transaction ledger derivation doesn't yet match storage on{' '}
                <strong>{count}</strong> {noun}. <strong>Your data is unaffected</strong> —
                this only matters if you flip the ledger source-of-truth toggle.
                {onOpenSettings && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="underline font-medium hover:opacity-80"
                    >
                      Details in Settings
                    </button>
                    .
                  </>
                )}
              </>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1 rounded transition-colors ${dismissHoverClass}`}
          aria-label="Dismiss for this session"
          title="Dismiss for this session"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
