import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import type { TimelineAnnotation } from '../types';

export function useAnnotations() {
  const [annotations, setAnnotations] = useLocalStorage<TimelineAnnotation[]>('timeline-annotations', []);

  const addAnnotation = useCallback(
    (date: string, label: string, color?: string) => {
      setAnnotations((prev) =>
        [...prev, { id: uuidv4(), date, label, ...(color && { color }) }]
          .sort((a, b) => a.date.localeCompare(b.date))
      );
    },
    [setAnnotations]
  );

  const deleteAnnotation = useCallback(
    (id: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    },
    [setAnnotations]
  );

  const updateAnnotation = useCallback(
    (id: string, data: Partial<Omit<TimelineAnnotation, 'id'>>) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data } : a))
      );
    },
    [setAnnotations]
  );

  return { annotations, addAnnotation, deleteAnnotation, updateAnnotation };
}
