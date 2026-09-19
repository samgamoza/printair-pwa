import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';

type Tone = 'default' | 'danger';

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

type ReasonOptions = ConfirmOptions & {
  /** Label above the text box. */
  label?: string;
  placeholder?: string;
};

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };

type DialogsValue = {
  /** Replaces window.confirm(): resolves true only if the person confirms. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Replaces window.prompt() for audit reasons: resolves the trimmed text, or null if dismissed. */
  askReason: (options: ReasonOptions) => Promise<string | null>;
  toast: (message: string, tone?: ToastTone) => void;
};

const DialogsContext = createContext<DialogsValue | null>(null);

type Pending =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'reason'; options: ReasonOptions; resolve: (v: string | null) => void };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  // Only one dialog shows at a time. If a second is requested while one is pending, the first is
  // answered "no" rather than left hanging forever.
  const replace = useCallback((next: Pending) => {
    setPending((current) => {
      if (current?.kind === 'confirm') current.resolve(false);
      if (current?.kind === 'reason') current.resolve(null);
      return next;
    });
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => replace({ kind: 'confirm', options, resolve })),
    [replace],
  );

  const askReason = useCallback(
    (options: ReasonOptions) =>
      new Promise<string | null>((resolve) => {
        setReason('');
        replace({ kind: 'reason', options, resolve });
      }),
    [replace],
  );

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ confirm, askReason, toast }), [confirm, askReason, toast]);

  function settle(accepted: boolean) {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(accepted);
    else pending.resolve(accepted ? reason.trim() : null);
    setPending(null);
  }

  const options = pending?.options;
  const danger = options?.tone === 'danger';
  const needsReason = pending?.kind === 'reason';

  return (
    <DialogsContext.Provider value={value}>
      {children}

      <Sheet open={pending !== null} onClose={() => settle(false)} size="sm" labelledBy="dialog-title" hideClose>
        {options && (
          <div className="px-6 pb-6 pt-6 sm:px-8 sm:pt-8">
            <span
              className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                danger ? 'bg-danger-50 text-danger-600' : 'bg-sun-100 text-sun-700'
              }`}
            >
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h2 id="dialog-title" className="mt-4 text-2xl text-ink-950">
              {options.title}
            </h2>
            {options.body && <p className="mt-2 text-ink-600">{options.body}</p>}

            {needsReason && (
              <label className="mt-5 block">
                <span className="mb-1.5 block text-sm font-bold text-ink-800">
                  {(options as ReasonOptions).label ?? 'Reason'} <span className="text-magenta-600">*</span>
                </span>
                <textarea
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={(options as ReasonOptions).placeholder ?? 'This is kept in the audit log.'}
                  className="control resize-none"
                />
              </label>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Never mind'}
              </Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
                disabled={needsReason && !reason.trim()}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <div
        className="pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-4 bottom-[calc(var(--sab)+5.75rem)] lg:bottom-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md animate-toast-in items-start gap-3 rounded-2xl bg-ink-950 py-3 pl-4 pr-3 text-sm font-medium text-white shadow-lift"
          >
            {t.tone === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf-300" />}
            {t.tone === 'error' && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-magenta-300" />}
            {t.tone === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />}
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </DialogsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDialogs() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used within DialogsProvider');
  return ctx;
}
