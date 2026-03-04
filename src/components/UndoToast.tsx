import { useState, useEffect, useRef, useCallback } from 'react';
import { Undo2, X } from 'lucide-react';

interface UndoToastProps {
  message: string;
  duration?: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ message, duration = 5000, onUndo, onDismiss }: UndoToastProps) {
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  useEffect(() => {
    startRef.current = Date.now();
    dismissedRef.current = false;

    function tick() {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 1 - elapsed / duration);
      setProgress(remaining * 100);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(dismiss, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, dismiss]);

  function handleUndo() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onUndo();
  }

  function handleClose() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    dismiss();
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`relative bg-surface-card border border-b-default shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 min-w-[300px] transition-all duration-300 ${
          exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        <span className="text-sm text-t-primary flex-1">{message}</span>
        <button
          onClick={handleUndo}
          className="flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover transition-colors whitespace-nowrap"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>
        <button
          onClick={handleClose}
          className="text-t-faint hover:text-t-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {/* Progress bar */}
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-surface-alt rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full"
            style={{ width: `${progress}%`, transition: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
