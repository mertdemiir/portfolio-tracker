import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ANNOTATION_COLORS = [
  { name: 'Accent', value: '' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Purple', value: '#8b5cf6' },
];

interface AddAnnotationModalProps {
  onAdd: (date: string, label: string, color?: string) => void;
  onClose: () => void;
}

export function AddAnnotationModal({ onAdd, onClose }: AddAnnotationModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !date) return;
    onAdd(date, label.trim(), color || undefined);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card rounded-2xl shadow-xl w-full max-w-sm p-5 animate-modal-enter">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-t-primary">Add Annotation</h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-alt rounded-lg transition-colors">
            <X className="w-4 h-4 text-t-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 40))}
              placeholder="e.g. Bought house, Got raise"
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              autoFocus
              required
              maxLength={40}
            />
            <p className="text-[10px] text-t-faint mt-0.5">{label.length}/40</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-t-muted mb-1">Color</label>
            <div className="flex items-center gap-2">
              {ANNOTATION_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-t-primary scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value || 'var(--accent)' }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
