import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface DeleteConfirmModalProps {
  ticker: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({ ticker, onConfirm, onClose }: DeleteConfirmModalProps) {
  return (
    <Modal
      title={
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 bg-loss-bg rounded-full flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
          </span>
          Delete {ticker}?
        </span>
      }
      onClose={onClose}
      size="sm"
    >
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
    </Modal>
  );
}
