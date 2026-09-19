import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export type CardTone = 'plain' | 'cyan' | 'magenta' | 'sun' | 'grape' | 'leaf' | 'ink' | 'danger';

const tones: Record<CardTone, string> = {
  plain: 'bg-white ring-1 ring-ink-900/5 shadow-soft',
  cyan: 'bg-cyan-50 ring-1 ring-cyan-200/70',
  magenta: 'bg-magenta-50 ring-1 ring-magenta-200/70',
  sun: 'bg-sun-50 ring-1 ring-sun-200',
  grape: 'bg-grape-50 ring-1 ring-grape-200/70',
  leaf: 'bg-leaf-50 ring-1 ring-leaf-200/70',
  ink: 'bg-ink-950 text-white',
  danger: 'bg-danger-50 ring-1 ring-danger-100',
};

export function Card({
  children,
  tone = 'plain',
  className = '',
  padded = true,
}: {
  children: ReactNode;
  tone?: CardTone;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`rounded-3xl ${tones[tone]} ${padded ? 'p-5 sm:p-6' : ''} ${className}`}>{children}</div>;
}

/** A whole card that navigates. Lifts slightly so it reads as tappable. */
export function LinkCard({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`group block rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-900/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.99] ${className}`}
    >
      {children}
    </Link>
  );
}

export function CardTitle({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg text-ink-950">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Read-only label/value rows. Rows with no value are skipped. */
export function KeyValueList({ rows }: { rows: { label: string; value: ReactNode | null | undefined }[] }) {
  const shown = rows.filter((r) => r.value !== null && r.value !== undefined && r.value !== '');
  return (
    <dl className="divide-y divide-ink-100">
      {shown.map((r) => (
        <div key={r.label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-sm font-bold text-ink-500">{r.label}</dt>
          <dd className="whitespace-pre-line text-ink-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Chevron() {
  return <ChevronRight className="h-5 w-5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-700" />;
}
