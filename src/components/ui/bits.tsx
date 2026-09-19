import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Paperclip, Star, X } from 'lucide-react';
import { InkLoader } from './Marks';
import { formatBytes } from '@/lib/format';

/* ---------- Page header ---------- */

export function PageHeader({
  title,
  subtitle,
  back,
  action,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  action?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
        >
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-balance text-3xl text-ink-950 sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-ink-600">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
    </header>
  );
}

/* ---------- Filter tabs ---------- */

export function FilterTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (key: T) => void;
  tabs: { key: T; label: string; count?: number }[];
}) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0" role="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition-all active:scale-95 ${
              active ? 'bg-ink-950 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-900/10 hover:text-ink-950'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-ink-100'}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Badge ---------- */

export type BadgeTone = 'neutral' | 'cyan' | 'magenta' | 'sun' | 'grape' | 'leaf' | 'danger' | 'muted';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  muted: 'bg-ink-100 text-ink-400',
  cyan: 'bg-cyan-100 text-cyan-800',
  magenta: 'bg-magenta-100 text-magenta-800',
  sun: 'bg-sun-200 text-sun-900',
  grape: 'bg-grape-100 text-grape-800',
  leaf: 'bg-leaf-100 text-leaf-800',
  danger: 'bg-danger-100 text-danger-700',
};

const dotTones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-400',
  muted: 'bg-ink-300',
  cyan: 'bg-cyan-500',
  magenta: 'bg-magenta-500',
  sun: 'bg-sun-600',
  grape: 'bg-grape-500',
  leaf: 'bg-leaf-500',
  danger: 'bg-danger-500',
};

export function Badge({ tone = 'neutral', children, dot = true }: { tone?: BadgeTone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${badgeTones[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotTones[tone]}`} />}
      {children}
    </span>
  );
}

/* ---------- Stars ---------- */

export function Stars({ rating, className = 'h-4 w-4' }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(rating) ? 'fill-sun-400 text-sun-400' : 'fill-ink-100 text-ink-100'}`} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-pressed={value === n}
          className="rounded-xl p-1 transition-transform hover:scale-110 active:scale-95"
        >
          <Star className={`h-9 w-9 ${n <= (hover || value) ? 'fill-sun-400 text-sun-400' : 'fill-ink-100 text-ink-100'}`} />
        </button>
      ))}
    </div>
  );
}

/* ---------- Avatar ---------- */

const avatarInks = ['bg-cyan-300', 'bg-magenta-300', 'bg-sun-300', 'bg-grape-300', 'bg-leaf-300'];

/** Initials on one of the five inks, chosen from the name so it never changes between visits. */
export function Avatar({ name, className = 'h-12 w-12 text-base', square = false }: { name: string; className?: string; square?: boolean }) {
  const clean = name.trim() || '?';
  const initials = clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-display font-extrabold text-ink-950 ${
        square ? 'rounded-2xl' : 'rounded-full'
      } ${avatarInks[hash % avatarInks.length]} ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ---------- File row ---------- */

export function FileRow({
  name,
  size,
  meta,
  onDownload,
  onRemove,
  busy,
}: {
  name: string;
  size?: number | null;
  meta?: ReactNode;
  onDownload?: () => void;
  onRemove?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ink-50 py-2.5 pl-3 pr-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-ink-600 ring-1 ring-ink-900/5">
        <Paperclip className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink-900">{name}</p>
        <p className="text-xs text-ink-500">{meta ?? formatBytes(size)}</p>
      </div>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          aria-label={`Download ${name}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-white disabled:opacity-60"
        >
          {busy ? <InkLoader className="[&>span]:h-1.5 [&>span]:w-1.5" /> : <Download className="h-5 w-5" />}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-white hover:text-danger-600"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/* ---------- Stat ---------- */

export function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 break-words font-display text-lg font-bold leading-tight text-ink-950">{value}</p>
    </div>
  );
}
