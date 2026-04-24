import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Sparkles, Wrench } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { todayDateString, formatCurrency } from '../utils/formatters';
import type { Holding, TransactionType } from '../types';

interface CashLedgerModalProps {
  holding: Holding;
  onEditDetails: () => void;
  onClose: () => void;
}

type Action = 'deposit' | 'withdrawal' | 'interest' | 'correction';

const ACTION_CONFIG: Record<
  Action,
  {
    label: string;
    verb: string;
    icon: typeof ArrowDownToLine;
    txnType: TransactionType;
    sign: 1 | -1;
    accentClass: string;
    helpText: string;
  }
> = {
  deposit: {
    label: 'Deposit',
    verb: 'Deposited',
    icon: ArrowDownToLine,
    txnType: 'deposit',
    sign: 1,
    accentClass: 'text-gain',
    helpText: 'Money added to this account (payroll, transfer in, sale proceeds).',
  },
  withdrawal: {
    label: 'Withdrawal',
    verb: 'Withdrew',
    icon: ArrowUpFromLine,
    txnType: 'withdrawal',
    sign: -1,
    accentClass: 'text-loss',
    helpText: 'Money removed (spending, transfer out, bill payment).',
  },
  interest: {
    label: 'Interest',
    verb: 'Credited interest',
    icon: Sparkles,
    txnType: 'interest',
    sign: 1,
    accentClass: 'text-gain',
    helpText: 'Interest or yield earned on this balance.',
  },
  correction: {
    label: 'Correction',
    verb: 'Adjusted',
    icon: Wrench,
    txnType: 'correction',
    sign: 1,
    accentClass: 'text-t-secondary',
    helpText: 'Reconcile the balance with reality. Enter a signed delta (can be negative).',
  },
};

export function CashLedgerModal({ holding, onEditDetails, onClose }: CashLedgerModalProps) {
  const { updateHolding, addTransaction } = usePortfolioContext();

  const [action, setAction] = useState<Action>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');

  const config = ACTION_CONFIG[action];
  const Icon = config.icon;
  const currency = holding.currency || 'USD';
  const isCorrection = action === 'correction';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');

    const amt = parseFloat(amount);
    if (isNaN(amt)) {
      setSubmitError('Enter a valid amount.');
      return;
    }
    if (!isCorrection && amt <= 0) {
      setSubmitError('Amount must be greater than zero.');
      return;
    }
    if (isCorrection && amt === 0) {
      setSubmitError('Correction amount cannot be zero.');
      return;
    }

    const signedDelta = config.sign * amt;
    const newBalance = holding.shares + signedDelta;

    if (newBalance < 0) {
      setSubmitError(
        `This ${config.label.toLowerCase()} would leave a negative balance (${newBalance.toFixed(2)} ${currency}). ` +
          `Use a Correction to reconcile if the true balance really is negative.`,
      );
      return;
    }

    // Build a clean Holding payload explicitly. The incoming `holding` may
    // be an EnrichedHolding (from HoldingsTable rows) with derived fields
    // like marketValue/allocation/gainLoss — never persist those.
    updateHolding(holding.id, {
      ticker: holding.ticker,
      name: holding.name,
      shares: newBalance,
      buyPrice: holding.buyPrice,
      buyDate: holding.buyDate,
      assetType: holding.assetType,
      inPortfolio: holding.inPortfolio,
      category: holding.category,
      portfolioId: holding.portfolioId,
      ...(holding.manualPrice !== undefined ? { manualPrice: holding.manualPrice } : {}),
      ...(holding.coinGeckoId ? { coinGeckoId: holding.coinGeckoId } : {}),
      ...(holding.lastManualPriceUpdate ? { lastManualPriceUpdate: holding.lastManualPriceUpdate } : {}),
      ...(holding.skipStaleCheck !== undefined ? { skipStaleCheck: holding.skipStaleCheck } : {}),
      ...(holding.isFavorite !== undefined ? { isFavorite: holding.isFavorite } : {}),
      ...(holding.currency ? { currency: holding.currency } : {}),
      ...(holding.buyFxRate !== undefined ? { buyFxRate: holding.buyFxRate } : {}),
    });

    // Magnitude stored on the transaction; `type` + `sign` semantics
    // determine the direction. Correction is always signed +1 but the
    // user-entered amount can be negative, so we store the signed value.
    const txnShares = isCorrection ? amt : Math.abs(amt);
    addTransaction({
      date,
      ticker: holding.ticker,
      name: holding.name,
      type: config.txnType,
      shares: txnShares,
      pricePerShare: 1,
      total: txnShares,
      portfolioId: holding.portfolioId,
      holdingId: holding.id,
      assetType: 'cash',
      category: holding.category,
      currency,
      ...(notes.trim() && { notes: notes.trim() }),
    });

    onClose();
  }

  return (
    <Modal title={`Cash: ${holding.name}`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current balance */}
        <div className="bg-surface-alt rounded-lg px-3 py-2 text-sm flex items-center justify-between">
          <span className="text-t-muted">Current balance</span>
          <span className="font-semibold text-t-primary tabular-nums">
            {formatCurrency({ amount: holding.shares, currency })}
          </span>
        </div>

        {/* Action chooser */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ACTION_CONFIG) as Action[]).map((a) => {
            const cfg = ACTION_CONFIG[a];
            const ActionIcon = cfg.icon;
            return (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAction(a);
                  setSubmitError('');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  action === a
                    ? 'border-accent bg-accent/5 text-t-primary'
                    : 'border-b-default text-t-muted hover:bg-surface-alt'
                }`}
              >
                <ActionIcon size={14} aria-hidden="true" />
                {cfg.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-t-muted">{config.helpText}</p>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-t-muted mb-1">
            Amount {currency !== 'USD' && <span className="text-t-faint">({currency})</span>}
            {isCorrection && <span className="ml-2 text-t-faint">— signed, can be negative</span>}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={isCorrection ? '-50.00' : '0.00'}
            step="any"
            className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-t-muted mb-1">Date</label>
          <input
            type="date"
            value={date}
            max={todayDateString()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-t-muted mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Payroll, Transfer from checking"
            rows={2}
            className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none"
          />
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-loss bg-loss-bg rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-accent text-white hover:bg-accent-hover`}
        >
          <Icon size={14} aria-hidden="true" />
          {config.verb} {amount && !isNaN(parseFloat(amount)) ? formatCurrency({ amount: Math.abs(parseFloat(amount)), currency }) : ''}
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onEditDetails();
          }}
          className={`w-full py-1.5 text-xs text-t-muted hover:text-t-secondary transition-colors ${config.accentClass ? '' : ''}`}
        >
          Edit holding details (name, category, currency) →
        </button>
      </form>
    </Modal>
  );
}
