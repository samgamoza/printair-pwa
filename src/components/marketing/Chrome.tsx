import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleUserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_HOME } from '@/routes/roles';
import { Logo, ColorBar } from '@/components/ui/Marks';
import { Avatar } from '@/components/ui/bits';
import { Button } from '@/components/ui/Button';
import { AccountSheet } from '@/components/shell/AccountSheet';

/** Top bar for the two welcome pages. */
export function MarketingHeader() {
  const { session, profile, openSignIn } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-900/5 bg-paper-200/85 backdrop-blur-xl">
      <div className="pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:px-8">
          <Link to="/" className="mr-auto">
            <Logo />
          </Link>
          <nav className="mr-2 hidden items-center gap-1 md:flex" aria-label="Sections">
            <Link to="/partners" className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 hover:bg-ink-100 hover:text-ink-950">
              Printing partners
            </Link>
            <Link to="/designers" className="rounded-full px-4 py-2 text-sm font-bold text-ink-600 hover:bg-ink-100 hover:text-ink-950">
              Designers
            </Link>
          </nav>
          {session && profile ? (
            <>
              <Button size="sm" onClick={() => navigate(ROLE_HOME[profile.role] ?? '/dashboard')} className="hidden sm:inline-flex">
                Open my workspace
              </Button>
              <button type="button" onClick={() => setAccountOpen(true)} aria-label="Account" className="rounded-full active:scale-95">
                <Avatar name={profile.full_name} className="h-10 w-10 text-sm" />
              </button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => openSignIn()}>
                Log in
              </Button>
              <button
                type="button"
                onClick={() => setAccountOpen(true)}
                aria-label="Account menu"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-700 active:scale-95"
              >
                <CircleUserRound className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </header>
  );
}

export function MarketingFooter() {
  const { openJoinPartner } = useAuth();
  const link = 'block min-h-10 py-2 font-medium text-white/65 transition-colors hover:text-white';
  return (
    <footer className="relative overflow-hidden bg-ink-950 text-white">
      <span className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 bg-halftone-lg bg-dots-lg text-white/[0.06]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-10 pt-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-sm text-white/60">
            PrintAir is your AI printing partner in the Philippines. We guide you from idea to professionally manufactured print
            products — no printing knowledge required.
          </p>
        </div>
        <div>
          <p className="slug text-white/40">Explore</p>
          <div className="mt-3">
            <Link to="/partners" className={link}>
              Printing partners
            </Link>
            <Link to="/designers" className={link}>
              Designers
            </Link>
            <a href="/#how" className={link}>
              How it works
            </a>
          </div>
        </div>
        <div>
          <p className="slug text-white/40">Work with us</p>
          <div className="mt-3">
            <button type="button" onClick={openJoinPartner} className={`${link} text-left`}>
              Join as a Printing Partner
            </button>
            <Link to="/design" className={link}>
              Apply as a designer
            </Link>
          </div>
        </div>
      </div>
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-white/10 px-5 py-6 sm:px-8">
        <p className="text-sm text-white/45">Made in the Philippines</p>
        <ColorBar size="h-2 w-5" />
      </div>
      <div className="pb-safe" />
    </footer>
  );
}
