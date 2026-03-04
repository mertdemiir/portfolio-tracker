import { Trash2 } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import type { TimelineAnnotation } from '../types';

interface AnnotationsListProps {
  annotations: TimelineAnnotation[];
  onDelete: (id: string) => void;
}

export function AnnotationsList({ annotations, onDelete }: AnnotationsListProps) {
  if (annotations.length === 0) {
    return (
      <p className="text-xs text-t-faint py-2">No annotations yet. Add one to mark events on your timeline.</p>
    );
  }

  return (
    <div className="space-y-1.5">
      {annotations.map((a) => (
        <div key={a.id} className="flex items-center justify-between group py-1">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: a.color || 'var(--accent)' }}
            />
            <span className="text-xs text-t-muted flex-shrink-0">
              {formatDate(a.date)}
            </span>
            <span className="text-xs text-t-primary truncate">{a.label}</span>
          </div>
          <button
            onClick={() => onDelete(a.id)}
            className="p-0.5 text-t-faint hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
