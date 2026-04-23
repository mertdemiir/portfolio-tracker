import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { DEFAULT_PORTFOLIO_ID } from '../types';

interface ManagePortfoliosModalProps {
  onClose: () => void;
}

export function ManagePortfoliosModal({ onClose }: ManagePortfoliosModalProps) {
  const { portfolios, createPortfolio, renamePortfolio, deletePortfolio, holdings } = usePortfolioContext();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // Bug 37: inline confirmation instead of native confirm()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name) {
      createPortfolio(name);
      setNewName('');
    }
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setEditName(currentName);
  }

  function saveEdit() {
    if (editingId && editName.trim()) {
      renamePortfolio(editingId, editName.trim());
      setEditingId(null);
      setEditName('');
    }
  }

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      deletePortfolio(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }

  return (
    <Modal title="Manage Portfolios" onClose={onClose} size="sm">
      <div className="space-y-2 mb-4">
          {portfolios.map((p) => {
            const count = holdings.filter((h) => (h.portfolioId || DEFAULT_PORTFOLIO_ID) === p.id).length;
            const isDefault = p.id === DEFAULT_PORTFOLIO_ID;
            const isEditing = editingId === p.id;

            return (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2.5 bg-surface rounded-lg">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="flex-1 px-2 py-1 border border-b-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                      autoFocus
                    />
                    <button
                      onClick={saveEdit}
                      className="p-1 text-gain hover:text-gain"
                      aria-label="Save portfolio name"
                    >
                      <Check size={14} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 text-t-faint hover:text-t-muted"
                      aria-label="Cancel rename"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-t-primary truncate">{p.name}</p>
                      <p className="text-xs text-t-faint">{count} holding{count !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => startEditing(p.id, p.name)}
                      className="p-1 text-t-faint hover:text-t-secondary transition-colors"
                      aria-label={`Rename ${p.name}`}
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    {!isDefault && confirmDeleteId === p.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-t-muted mr-1">Delete?</span>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 text-loss hover:text-loss/80 transition-colors"
                          title="Confirm delete"
                          aria-label={`Confirm delete ${p.name}`}
                        >
                          <Check size={13} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1 text-t-faint hover:text-t-muted transition-colors"
                          title="Cancel"
                          aria-label="Cancel delete"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ) : !isDefault && (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-1 text-t-faint hover:text-loss transition-colors"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New portfolio name"
            className="flex-1 px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add
          </button>
        </form>
    </Modal>
  );
}
