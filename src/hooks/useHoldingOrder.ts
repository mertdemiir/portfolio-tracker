import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export function useHoldingOrder() {
  const [order, setOrder] = useLocalStorage<string[]>('holding-order', []);

  /** Ensures all holdingIds are in the order list. Appends missing, removes deleted. */
  const syncOrder = useCallback(
    (holdingIds: string[]) => {
      setOrder((prev) => {
        const idSet = new Set(holdingIds);
        // Keep existing order for IDs still present
        const kept = prev.filter((id) => idSet.has(id));
        // Append any new IDs not yet in the order
        const keptSet = new Set(kept);
        const added = holdingIds.filter((id) => !keptSet.has(id));
        const merged = [...kept, ...added];
        // Only update if changed
        if (merged.length === prev.length && merged.every((id, i) => prev[i] === id)) {
          return prev;
        }
        return merged;
      });
    },
    [setOrder]
  );

  /** Reorder: move activeId to the position of overId */
  const reorder = useCallback(
    (activeId: string, overId: string) => {
      setOrder((prev) => {
        const oldIndex = prev.indexOf(activeId);
        const newIndex = prev.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const next = [...prev];
        next.splice(oldIndex, 1);
        next.splice(newIndex, 0, activeId);
        return next;
      });
    },
    [setOrder]
  );

  return { order, syncOrder, reorder };
}
