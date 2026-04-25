import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  /** Visible title. Rendered in <h2> and linked via aria-labelledby. */
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Hide the built-in close (X) button — for flows that require explicit
   * action before dismissal (e.g. PreUpdateNagModal).
   */
  hideCloseButton?: boolean;
  /** Disable ESC-to-close and backdrop-click-to-close. */
  disableDismiss?: boolean;
  /**
   * Size of the card. Accepts the size presets above, mapped to Tailwind
   * max-w-* classes.
   */
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

/**
 * Shared modal chrome with accessibility baked in:
 *  - role="dialog" + aria-modal="true"
 *  - aria-labelledby pointing at the <h2> title
 *  - Focus trap (Tab/Shift-Tab cycles inside)
 *  - ESC closes the dialog (unless disableDismiss)
 *  - Focus restoration to the element that opened the dialog
 *
 * All modals in the app route through this component. The backdrop click
 * closes by default; titles are required so assistive tech always knows
 * what dialog is open.
 */
export function Modal({
  title,
  onClose,
  children,
  size = 'md',
  hideCloseButton = false,
  disableDismiss = false,
  className,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element and restore on unmount. Move
  // focus to the dialog container itself (tabindex=-1) — this lets the
  // screen reader announce the dialog + title, and the first Tab lands on
  // the first real control rather than the close X.
  useEffect(() => {
    previousActiveRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => {
      // Restore focus. Guard against the element having been unmounted
      // (e.g. the button that opened this was inside a now-removed list).
      const el = previousActiveRef.current;
      if (el && document.contains(el)) {
        el.focus();
      }
    };
  }, []);

  // ESC handler
  useEffect(() => {
    if (disableDismiss) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [disableDismiss, onClose]);

  // Focus trap on Tab
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px]"
        onClick={disableDismiss ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative bg-surface-card border border-b-default w-full ${SIZE_CLASS[size]} p-6 max-h-[90vh] overflow-y-auto animate-modal-enter outline-none ${className ?? ''}`}
        style={{
          borderRadius: 14,
          boxShadow: '0 24px 60px -24px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id={titleId}
            className="text-base font-semibold text-t-primary"
            style={{ letterSpacing: 'var(--letter-spacing-heading)' }}
          >
            {title}
          </h2>
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className="m-icon-btn"
              aria-label="Close dialog"
            >
              <X className="w-[16px] h-[16px]" aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
