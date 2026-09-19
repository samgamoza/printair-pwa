import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal, Plus, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo, ColorBar } from '@/components/ui/Marks';
import { Avatar } from '@/components/ui/bits';
import { Sheet } from '@/components/ui/Sheet';
import { AccountSheet } from './AccountSheet';
import { InstallBanner } from '@/pwa/InstallBanner';
import { useOnline } from '@/pwa/useOnline';

export type ShellNavItem = {
  to: string;
  label: string;
  /** Shorter label for the phone tab bar, where five words won't fit. */
  short?: string;
  icon: LucideIcon;
  end?: boolean;
  /** In-app status indicator — e.g. new opportunities awaiting a first look. */
  count?: number;
};

function CountBadge({ count, className = '' }: { count?: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-magenta-500 px-1.5 text-[0.65rem] font-extrabold leading-none text-white ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * The signed-in frame for every role.
 *
 * Phone: slim top bar, content, and a tab bar along the bottom edge with an
 * optional raised "create" button in the middle. Anything past four
 * destinations folds into a "More" sheet.
 * Desktop (1024px+): the same destinations become an ink-black side rail.
 */
export function AppShell({
  navItems,
  roleLabel,
  banner,
  create,
  children,
}: {
  navItems: ShellNavItem[];
  roleLabel: string;
  banner?: ReactNode;
  create?: { label: string; onClick: () => void };
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const online = useOnline();

  const maxTabs = create ? 4 : 5;
  const overflow = navItems.length > maxTabs;
  const tabs = overflow ? navItems.slice(0, maxTabs - 1) : navItems;
  const more = overflow ? navItems.slice(maxTabs - 1) : [];
  const moreCount = more.reduce((n, i) => n + (i.count ?? 0), 0);

  // With a create button the tabs split evenly around it.
  const half = Math.ceil(tabs.length / 2);
  const leftTabs = create ? tabs.slice(0, half) : tabs;
  const rightTabs = create ? tabs.slice(half) : [];

  const name = profile?.full_name ?? 'Account';

  const tab = (item: ShellNavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `group flex min-w-0 flex-1 flex-col items-center gap-1 pt-2.5 text-[0.68rem] font-bold transition-colors ${
          isActive ? 'text-ink-950' : 'text-ink-400'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-sun-300' : ''}`}>
            <item.icon className="h-[1.35rem] w-[1.35rem]" strokeWidth={isActive ? 2.4 : 2} />
            <CountBadge count={item.count} className="absolute -top-1 right-1.5" />
          </span>
          <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-[100dvh] bg-paper-200 lg:pl-72">
      {/* ---------- Desktop side rail ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-hidden bg-ink-950 p-5 text-white lg:flex">
        <span className="pointer-events-none absolute -bottom-10 -left-10 h-64 w-64 bg-halftone-lg bg-dots-lg text-white/[0.07]" aria-hidden="true" />
        <Link to="/" className="relative px-2 py-1">
          <Logo tone="light" />
        </Link>
        <p className="relative mt-6 px-3 text-[0.68rem] font-extrabold uppercase tracking-[0.16em] text-white/40">{roleLabel}</p>

        {create && (
          <button
            type="button"
            onClick={create.onClick}
            className="relative mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full bg-magenta-500 font-bold text-white shadow-magenta transition-all hover:bg-magenta-400 active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.75} /> {create.label}
          </button>
        )}

        <nav className="relative mt-4 flex-1 space-y-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-2xl px-3.5 font-bold transition-colors ${
                  isActive ? 'bg-white text-ink-950' : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1 truncate">{item.label}</span>
              <CountBadge count={item.count} />
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setAccountOpen(true)}
          className="relative mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 text-left transition-colors hover:bg-white/[0.12]"
        >
          <Avatar name={name} className="h-10 w-10 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{name}</span>
            <span className="block truncate text-xs text-white/50">{profile?.email}</span>
          </span>
          <MoreHorizontal className="h-5 w-5 text-white/40" />
        </button>
        <ColorBar className="relative mt-4 px-1" size="h-1.5 w-6" />
      </aside>

      {/* ---------- Phone top bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-ink-900/5 bg-paper-200/85 backdrop-blur-xl lg:hidden">
        <div className="pt-safe">
          <div className="flex h-14 items-center justify-between px-5">
            <Link to="/">
              <Logo markClassName="h-8 w-8" />
            </Link>
            <button type="button" onClick={() => setAccountOpen(true)} aria-label="Account" className="rounded-full active:scale-95">
              <Avatar name={name} className="h-9 w-9 text-xs" />
            </button>
          </div>
        </div>
      </header>

      {!online && (
        <div role="status" className="flex items-center justify-center gap-2 bg-ink-950 px-5 py-2.5 text-center text-sm font-bold text-white">
          <WifiOff className="h-4 w-4 text-sun-300" /> You&apos;re offline. Changes can&apos;t be saved until you reconnect.
        </div>
      )}

      {banner}

      <main className="mx-auto w-full max-w-5xl px-5 pb-tabbar pt-6 sm:px-8 lg:pb-16 lg:pt-10">
        <InstallBanner className="mb-6 lg:hidden" />
        {children}
      </main>

      {/* ---------- Phone tab bar ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 rounded-t-[1.75rem] bg-white shadow-nav lg:hidden" aria-label="Main">
        <div className="relative flex h-[var(--tabbar-h)] items-start px-2">
          {leftTabs.map(tab)}
          {create && (
            <div className="flex w-20 shrink-0 justify-center">
              <button
                type="button"
                onClick={create.onClick}
                aria-label={create.label}
                className="-mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-magenta-500 text-white shadow-magenta ring-[6px] ring-paper-200 transition-transform active:scale-90"
              >
                <Plus className="h-7 w-7" strokeWidth={2.75} />
              </button>
            </div>
          )}
          {rightTabs.map(tab)}
          {overflow && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 pt-2.5 text-[0.68rem] font-bold text-ink-400"
            >
              <span className="relative flex h-8 w-14 items-center justify-center rounded-full">
                <MoreHorizontal className="h-[1.35rem] w-[1.35rem]" />
                <CountBadge count={moreCount} className="absolute -top-1 right-1.5" />
              </span>
              More
            </button>
          )}
        </div>
        <div className="pb-safe" />
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} size="sm" labelledBy="more-title">
        <div className="px-4 pb-5 pt-5">
          <h2 id="more-title" className="px-2 pb-3 text-2xl text-ink-950">
            More
          </h2>
          {more.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex min-h-14 items-center gap-3.5 rounded-2xl px-3 font-bold transition-colors ${
                  isActive ? 'bg-sun-100 text-ink-950' : 'text-ink-900 hover:bg-ink-50'
                }`
              }
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-ink-700">
                <item.icon className="h-5 w-5" />
              </span>
              <span className="flex-1">{item.label}</span>
              <CountBadge count={item.count} />
            </NavLink>
          ))}
        </div>
      </Sheet>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
