import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import type { Liability } from '../types';

export function useLiabilities() {
  const [liabilities, setLiabilities] = useLocalStorage<Liability[]>('liabilities', []);

  const addLiability = useCallback(
    (data: Omit<Liability, 'id'>) => {
      setLiabilities((prev) => [...prev, { ...data, id: uuidv4() }]);
    },
    [setLiabilities]
  );

  const updateLiability = useCallback(
    (id: string, data: Omit<Liability, 'id'>) => {
      setLiabilities((prev) =>
        prev.map((l) => (l.id === id ? { ...data, id } : l))
      );
    },
    [setLiabilities]
  );

  const deleteLiability = useCallback(
    (id: string) => {
      setLiabilities((prev) => prev.filter((l) => l.id !== id));
    },
    [setLiabilities]
  );

  return { liabilities, addLiability, updateLiability, deleteLiability };
}
