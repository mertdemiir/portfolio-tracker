import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from './Modal';
import { useSettings } from '../context/SettingsContext';

interface AllocationTargetEditorProps {
  onClose: () => void;
}

export function AllocationTargetEditor({ onClose }: AllocationTargetEditorProps) {
  const { allCategories, targetAllocations, setTargetAllocation, removeTargetAllocation } =
    useSettings();

  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const cat of allCategories) {
      const target = targetAllocations.find((t) => t.categoryKey === cat.key);
      map[cat.key] = target ? String(target.targetPercent) : '';
    }
    return map;
  });

  const total = Object.values(values).reduce((sum, v) => {
    const n = parseFloat(v);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  function handleSave() {
    for (const cat of allCategories) {
      const val = parseFloat(values[cat.key]);
      if (!isNaN(val) && val > 0) {
        setTargetAllocation(cat.key, val);
      } else {
        removeTargetAllocation(cat.key);
      }
    }
    onClose();
  }

  return (
    <Modal title="Set Target Allocations" onClose={onClose} size="sm">
      <div className="space-y-2 mb-4">
        {allCategories.map((cat) => (
          <div key={cat.key} className="flex items-center gap-3">
            <span className="text-sm text-t-secondary flex-1 truncate">{cat.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={values[cat.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                placeholder="0"
                min="0"
                max="100"
                step="0.1"
                className="w-20 px-2 py-1.5 border border-b-input rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
              <span className="text-xs text-t-faint">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-b-default pt-3">
        <span
          className={`text-sm font-medium ${
            Math.abs(total - 100) < 0.1 ? 'text-green-600' : 'text-amber-600'
          }`}
        >
          Total: {total.toFixed(1)}%
          {Math.abs(total - 100) >= 0.1 && total > 0 && (
            <span className="text-xs ml-1">(should be 100%)</span>
          )}
        </span>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors"
        >
          <Check size={14} aria-hidden="true" />
          Save
        </button>
      </div>
    </Modal>
  );
}
