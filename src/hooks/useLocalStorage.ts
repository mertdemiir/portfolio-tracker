import { useState, useCallback, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Re-read from localStorage if key changes
  useEffect(() => {
    try {
      const item = localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item) as T);
    } catch { /* ignore */ }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-tab synchronization: listen for storage events from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch { /* ignore malformed data */ }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // localStorage full or unavailable
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue] as const;
}
