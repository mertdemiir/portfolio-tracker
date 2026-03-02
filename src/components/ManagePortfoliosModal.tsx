import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Pencil, Check } from 'lucide-react';
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

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
    const holdingCount = holdings.filter((h) => (h.portfolioId || DEFAULT_PORTFOLIO_ID) === id).length;
    const msg = holdingCount > 0
      ? `Delete this portfolio? ${holdingCount} holding(s) will be moved to the default portfolio.`
      : 'Delete this portfolio?';
    if (!confirm(msg)) return;
    deletePortfolio(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card rounded-2xl shadow-xl w-full max-w-sm p-6 animate-modal-enter">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-t-primary">Manage Portfolios</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-alt rounded-lg transition-colors">
            <X className="w-5 h-5 text-t-muted" />
          </button>
        </div>

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
                    <button onClick={saveEdit} className="p-1 text-gain hover:text-gain">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-t-faint hover:text-t-muted">
                      <X size={14} />
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
                    >
                      <Pencil size={13} />
                    </button>
                    {!isDefault && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 text-t-faint hover:text-loss transition-colors"
                      >
                        <Trash2 size={13} />
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
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
