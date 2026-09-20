import { useState } from 'react';
import { Eye, RotateCcw, X } from 'lucide-react';
import { DEMO_ROLE_KEY, resetDemoData, setDemoRole } from './install';
import { setLook, useLook, type Look } from '@/lib/look';

const LOOKS: { key: Look; label: string; note: string }[] = [
  { key: 'mixed', label: 'Mixed', note: 'New design, with the original website’s look on sign-up, partner onboarding and the project builder.' },
  { key: 'process', label: 'New only', note: 'The new design everywhere.' },
  { key: 'classic', label: 'Classic', note: 'The original website’s fonts and colours everywhere, in the new layout.' },
];

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
  const look = useLook();
  const current = localStorage.getItem(DEMO_ROLE_KEY);

  function choose(role: string | null) {
    setDemoRole(role);
    // A full reload, so every screen starts clean as that person.
    window.location.assign(role ? '/app' : '/');
  }

  return (
    // Phones: a small tab on the left edge, clear of the header, the tabs and the page's own text.
    // Desktop: a labelled pill beside the assistant.
    <div className="fixed left-0 top-[42%] z-[130] lg:bottom-5 lg:left-auto lg:right-28 lg:top-auto">
      {open && (
        <div className="fixed inset-x-3 top-[calc(var(--sat)+4.5rem)] mx-auto max-w-sm rounded-3xl bg-white p-3 shadow-lift ring-1 ring-ink-900/10 lg:static lg:mx-0 lg:mb-2 lg:w-72">
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
          <div className="mt-2 border-t border-ink-100 px-2 pt-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-ink-500">Look</p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-ink-100 p-1">
              {LOOKS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLook(l.key)}
                  aria-pressed={look === l.key}
                  className={`rounded-xl px-1 py-2 text-xs font-bold leading-tight ${look === l.key ? 'bg-white text-ink-950 shadow-soft' : 'text-ink-600 hover:text-ink-950'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="pb-1 pt-2 text-xs text-ink-500">{LOOKS.find((l) => l.key === look)?.note}</p>
          </div>
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
        aria-label={`Demo${current ? `: ${current}` : ''}`}
        className="flex min-h-11 items-center gap-2 rounded-r-full bg-sun-400/90 pl-1.5 pr-2.5 text-sm font-extrabold text-ink-950 shadow-lift ring-2 ring-ink-950 active:scale-95 lg:min-h-10 lg:rounded-full lg:px-4"
      >
        <Eye className="h-4 w-4" />
        <span className="hidden lg:inline">Demo{current ? `: ${current}` : ''}</span>
      </button>
    </div>
  );
}
