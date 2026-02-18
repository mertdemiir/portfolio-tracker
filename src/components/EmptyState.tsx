import { PlusCircle, TrendingUp } from 'lucide-react';

interface EmptyStateProps {
  onAdd: () => void;
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
        <TrendingUp className="w-8 h-8 text-blue-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">No holdings yet</h2>
      <p className="text-slate-500 mb-6 max-w-sm">
        Start tracking your wealth by adding your first asset.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        <PlusCircle className="w-5 h-5" />
        Add Your First Asset
      </button>
    </div>
  );
}
