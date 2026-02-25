import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  ticker: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({ ticker, onConfirm, onClose }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface-card rounded-xl shadow-xl w-full max-w-sm p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-surface-alt rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-t-muted" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-t-primary">Delete {ticker}?</h2>
        </div>

        <p className="text-sm text-t-muted mb-6">
          This will permanently remove {ticker} from your holdings. This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-b-input rounded-lg text-sm font-medium text-t-secondary hover:bg-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
