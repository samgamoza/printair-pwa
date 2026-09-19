import { useState } from 'react';
import { Eye, RotateCcw, X } from 'lucide-react';
import { DEMO_ROLE_KEY, resetDemoData, setDemoRole } from './install';

const ROLES: { key: string | null; label: string; who: string; tint: string }[] = [
  { key: null, label: 'Visitor', who: 'Signed out', tint: 'bg-ink-100' },
  { key: 'customer', label: 'Customer', who: 'Maria · café owner', tint: 'bg-cyan-200' },
  { key: 'partner', label: 'Printing partner', who: 'Ramon · Manila Offset Press', tint: 'bg-sun-200' },
  { key: 'designer', label: 'Designer', who: 'Bea · packaging designer', tint: 'bg-magenta-200' },
  { key: 'admin', label: 'Admin', who: 'PrintAir staff', tint: 'bg-grape-200' },
];

/** Demo mode only: jump between the four kinds of account without signing in. */
export function DemoSwitcher() {
  const [open, setOpen] = useState(false);
  const current = localStorage.getItem(DEMO_ROLE_KEY);

  function choose(role: string | null) {
    setDemoRole(role);
    // A full reload, so every screen starts clean as that person.
    window.location.assign(role ? '/app' : '/');
  }

  return (
    <div className="fixed left-3 top-[calc(var(--sat)+4.25rem)] z-[130] lg:bottom-5 lg:left-auto lg:right-28 lg:top-auto">
      {open && (
        <div className="mb-2 w-72 rounded-3xl bg-white p-3 shadow-lift ring-1 ring-ink-900/10">
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="font-display text-lg font-bold text-ink-950">View the demo as…</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          {ROLES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => choose(r.key)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink-50 ${current === r.key ? 'ring-2 ring-ink-950' : ''}`}
            >
              <span className={`h-10 w-10 shrink-0 rounded-xl ${r.tint}`} />
              <span>
                <span className="block font-bold text-ink-950">{r.label}</span>
                <span className="block text-sm text-ink-500">{r.who}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              resetDemoData();
              window.location.reload();
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-2xl p-2 text-left text-ink-700 hover:bg-ink-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100">
              <RotateCcw className="h-4 w-4" />
            </span>
            <span className="font-bold">Reset sample data</span>
          </button>
          <p className="px-2 pt-2 text-xs text-ink-500">Sample data only. What you do carries across roles until you close this tab.</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 items-center gap-2 rounded-full bg-sun-400 px-4 text-sm font-extrabold text-ink-950 shadow-lift ring-2 ring-ink-950 active:scale-95"
      >
        <Eye className="h-4 w-4" /> Demo{current ? `: ${current}` : ''}
      </button>
    </div>
  );
}
