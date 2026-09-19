import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type SheetSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Sheets stack (the sign-in sheet opens over the project builder), so page scrolling is locked by
 * a shared count rather than by each sheet saving and restoring the previous value — with two open,
 * "restore what I found" hands the lock back and forth and can leave the page frozen for good.
 */
let openSheets = 0;

const widths: Record<SheetSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

/**
 * One surface for every overlay: it rises from the bottom edge on a phone and
 * sits centred as a dialog on wider screens. `full` makes it take the whole
 * phone screen, for multi-step flows like the project builder.
 */
export function Sheet({
  open,
  onClose,
  children,
  labelledBy,
  size = 'md',
  full = false,
  hideClose = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  size?: SheetSize;
  full?: boolean;
  hideClose?: boolean;
  /** Pinned below the scrolling content — where the primary action lives on a phone. */
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass a fresh onClose on every render; keeping it in a ref stops the effect below
  // tearing down and re-running each time.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    openSheets += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      openSheets = Math.max(0, openSheets - 1);
      if (openSheets === 0) document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/55 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative z-10 flex w-full flex-col overflow-hidden bg-white shadow-lift animate-sheet-up sm:animate-pop-in sm:rounded-4xl ${
          widths[size]
        } ${full ? 'h-[100dvh] sm:h-auto sm:max-h-[90vh]' : 'max-h-[92dvh] rounded-t-4xl sm:max-h-[90vh]'}`}
      >
        {!full && <span className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-ink-200 sm:hidden" aria-hidden="true" />}
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`absolute right-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-700 transition-colors hover:bg-ink-200 active:scale-95 ${
              full ? 'top-[calc(var(--sat)+0.75rem)] sm:top-4' : 'top-4'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div className={`no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain ${full ? 'pt-safe sm:pt-0' : ''}`}>
          {children}
          {!footer && <div className="pb-safe" />}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-ink-100 bg-white/95 px-5 pt-3 backdrop-blur sm:px-8">
            {footer}
            <div className="pb-safe h-3 box-content" />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
