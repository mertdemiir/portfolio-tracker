import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import { todayDateString } from '../utils/formatters';
import type { WatchlistItem } from '../types';

export function useWatchlist() {
  const [items, setItems] = useLocalStorage<WatchlistItem[]>('watchlist-items', []);

  const addItem = useCallback(
    (data: Omit<WatchlistItem, 'id' | 'addedDate'>) => {
      setItems((prev) => {
        // Don't add duplicates
        if (prev.some((item) => item.ticker === data.ticker && item.assetType === data.assetType)) {
          return prev;
        }
        return [...prev, { ...data, id: uuidv4(), addedDate: todayDateString() }];
      });
    },
    [setItems]
  );

  const deleteItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setItems]
  );

  return { items, addItem, deleteItem };
}
