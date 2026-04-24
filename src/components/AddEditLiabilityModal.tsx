import { useState } from 'react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { LIABILITY_CATEGORIES, SUPPORTED_CURRENCIES } from '../types';
import type { Liability, LiabilityCategory } from '../types';

interface AddEditLiabilityModalProps {
  liability?: Liability;
  onClose: () => void;
}

export function AddEditLiabilityModal({ liability, onClose }: AddEditLiabilityModalProps) {
  const { addLiability, updateLiability } = usePortfolioContext();
  const { baseCurrency } = useSettings();
  const isEdit = !!liability;

  const [name, setName] = useState(liability?.name || '');
  const [category, setCategory] = useState<LiabilityCategory>(liability?.category || 'other-liability');
  const [balance, setBalance] = useState(liability?.balance?.toString() || '');
  const [interestRate, setInterestRate] = useState(liability?.interestRate?.toString() || '');
  const [minimumPayment, setMinimumPayment] = useState(liability?.minimumPayment?.toString() || '');
  const [currency, setCurrency] = useState(liability?.currency || baseCurrency);
  const [startDate, setStartDate] = useState(liability?.startDate || '');
  const [notes, setNotes] = useState(liability?.notes || '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const bal = parseFloat(balance);
    if (!name.trim() || isNaN(bal) || bal <= 0) return;

    const data: Omit<Liability, 'id'> = {
      name: name.trim(),
      category,
      balance: bal,
      ...(interestRate && !isNaN(parseFloat(interestRate)) && { interestRate: parseFloat(interestRate) }),
      ...(minimumPayment && !isNaN(parseFloat(minimumPayment)) && { minimumPayment: parseFloat(minimumPayment) }),
      currency,
      ...(startDate && { startDate }),
      ...(notes.trim() && { notes: notes.trim() }),
    };

    if (isEdit && liability) {
      updateLiability(liability.id, data);
    } else {
      addLiability(data);
    }
    onClose();
  }

  return (
    <Modal
      title={isEdit ? 'Edit Liability' : 'Add Liability'}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home Mortgage, Chase Sapphire"
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              autoFocus
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as LiabilityCategory)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              {LIABILITY_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Balance + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Balance</label>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Interest Rate + Minimum Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Interest Rate (%)</label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 6.5"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-t-muted mb-1">Min. Payment</label>
              <input
                type="number"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value)}
                placeholder="Monthly"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Start Date (optional)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              {isEdit ? 'Save Changes' : 'Add Liability'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
    </Modal>
  );
}
