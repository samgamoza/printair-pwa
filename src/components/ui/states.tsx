import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Info, WifiOff } from 'lucide-react';
import { Button } from './Button';
import { InkLoader, RegistrationMark } from './Marks';

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-500">
      <InkLoader className="[&>span]:h-3.5 [&>span]:w-3.5" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/** Placeholder rows while a list loads, so the page doesn't jump when data lands. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-3xl bg-white p-5 ring-1 ring-ink-900/5">
          <div className="skeleton h-5 w-2/5" />
          <div className="skeleton mt-3 h-4 w-3/5" />
          <div className="skeleton mt-5 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = 'sun',
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  tone?: 'sun' | 'cyan' | 'magenta' | 'grape';
}) {
  const tints = {
    sun: 'bg-sun-200 text-ink-950',
    cyan: 'bg-cyan-200 text-ink-950',
    magenta: 'bg-magenta-200 text-ink-950',
    grape: 'bg-grape-200 text-ink-950',
  };
  return (
    <div className="relative overflow-hidden rounded-4xl border-2 border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
      <RegistrationMark className="absolute left-4 top-4 h-5 w-5 text-ink-200" />
      <RegistrationMark className="absolute bottom-4 right-4 h-5 w-5 text-ink-200" />
      <span className={`mx-auto flex h-16 w-16 -rotate-6 items-center justify-center rounded-3xl ${tints[tone]}`}>
        <Icon className="h-8 w-8" strokeWidth={1.75} />
      </span>
      <h3 className="mt-5 text-xl text-ink-950">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-sm text-ink-600">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "That didn't load", message, onRetry }: { title?: string; message?: string | null; onRetry?: () => void }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="rounded-4xl bg-danger-50 px-6 py-10 text-center ring-1 ring-danger-100">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-danger-600">
        {offline ? <WifiOff className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
      </span>
      <h3 className="mt-4 text-xl text-ink-950">{offline ? "You're offline" : title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-ink-600">
        {offline ? 'Reconnect and try again — your work here is safe.' : message || 'Something went wrong on our side. Please try again.'}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

type BannerTone = 'info' | 'warning' | 'danger' | 'success';

/** Inline notice. Used for form errors as well as page-level warnings. */
export function Banner({
  tone = 'info',
  children,
  action,
  className = '',
}: {
  tone?: BannerTone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles: Record<BannerTone, { box: string; icon: ReactNode }> = {
    info: { box: 'bg-cyan-50 text-cyan-900 ring-cyan-200', icon: <Info className="h-5 w-5 text-cyan-600" /> },
    warning: { box: 'bg-sun-100 text-sun-900 ring-sun-300', icon: <AlertTriangle className="h-5 w-5 text-sun-700" /> },
    danger: { box: 'bg-danger-50 text-danger-700 ring-danger-100', icon: <AlertTriangle className="h-5 w-5 text-danger-600" /> },
    success: { box: 'bg-leaf-50 text-leaf-800 ring-leaf-200', icon: <CheckCircle2 className="h-5 w-5 text-leaf-600" /> },
  };
  const s = styles[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${s.box} ${className}`}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** The one-line form error used throughout. Renders nothing when there is no error. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <Banner tone="danger">{children}</Banner>;
}
