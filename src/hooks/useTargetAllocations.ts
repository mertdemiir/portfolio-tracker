import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { TargetAllocation } from '../types';

export function useTargetAllocations() {
  const [targetAllocations, setTargetAllocations] = useLocalStorage<TargetAllocation[]>(
    'target-allocations',
    []
  );

  const setTargetAllocation = useCallback(
    (categoryKey: string, targetPercent: number) => {
      setTargetAllocations((prev) => {
        const existing = prev.find((t) => t.categoryKey === categoryKey);
        if (existing) {
          return prev.map((t) =>
            t.categoryKey === categoryKey ? { ...t, targetPercent } : t
          );
        }
        return [...prev, { categoryKey, targetPercent }];
      });
    },
    [setTargetAllocations]
  );

  const removeTargetAllocation = useCallback(
    (categoryKey: string) => {
      setTargetAllocations((prev) => prev.filter((t) => t.categoryKey !== categoryKey));
    },
    [setTargetAllocations]
  );

  return { targetAllocations, setTargetAllocation, removeTargetAllocation, setTargetAllocations };
}
