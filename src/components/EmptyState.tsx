import { PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  onAdd: () => void;
}

/**
 * Mercury-style empty state — dashed border, subtle gradient bg,
 * accent-light mark, display-font heading, primary action.
 */
export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center p-16"
      style={{
        border: '1px dashed var(--border-default)',
        borderRadius: 12,
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-card) 70%, transparent), var(--surface-card))',
      }}
    >
      <div
        className="flex items-center justify-center mb-5"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'var(--accent-light)',
          color: 'var(--accent)',
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 500,
        }}
        aria-hidden="true"
      >
        +
      </div>
      <h2
        className="mb-1.5"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}
      >
        No holdings yet
      </h2>
      <p
        className="max-w-sm mb-5"
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Start tracking your wealth by adding your first asset.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
        style={{
          background: 'var(--surface-emph)',
          color: 'var(--text-on-emph)',
        }}
      >
        <PlusCircle className="w-[16px] h-[16px]" aria-hidden="true" />
        Add your first asset
      </button>
    </div>
  );
}
