import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Key, Tag } from 'lucide-react';
import type { CustomCategory } from '../types';

interface SettingsModalProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  customCategories: CustomCategory[];
  onAddCategory: (label: string) => void;
  onDeleteCategory: (key: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  apiKey,
  onSaveApiKey,
  customCategories,
  onAddCategory,
  onDeleteCategory,
  onClose,
}: SettingsModalProps) {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  function handleSaveKey() {
    const trimmed = keyInput.trim();
    if (trimmed) {
      onSaveApiKey(trimmed);
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    }
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const label = newCategoryLabel.trim();
    if (label) {
      onAddCategory(label);
      setNewCategoryLabel('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* API Key Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Finnhub API Key</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Enter your Finnhub API key"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleSaveKey}
              disabled={!keyInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {keySaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Required for live stock & ETF prices.
          </p>
        </div>

        {/* Custom Categories Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Custom Categories</h3>
          </div>

          {customCategories.length > 0 ? (
            <div className="space-y-2 mb-3">
              {customCategories.map((cat) => (
                <div
                  key={cat.key}
                  className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg"
                >
                  <span className="text-sm text-slate-700">{cat.label}</span>
                  <button
                    onClick={() => onDeleteCategory(cat.key)}
                    className="p-1 hover:bg-red-50 rounded transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">No custom categories yet.</p>
          )}

          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              placeholder="New category name"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!newCategoryLabel.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
