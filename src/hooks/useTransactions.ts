import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import type { Transaction } from '../types';

export function useTransactions() {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('transactions', []);

  const addTransaction = useCallback(
    (data: Omit<Transaction, 'id'>) => {
      setTransactions((prev) => [...prev, { ...data, id: uuidv4() }]);
    },
    [setTransactions]
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [setTransactions]
  );

  return { transactions, addTransaction, deleteTransaction };
}
