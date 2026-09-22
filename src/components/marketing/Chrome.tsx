import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleUserRound, Mail, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_HOME } from '@/routes/roles';
import { Logo, ColorBar } from '@/components/ui/Marks';
import { Avatar } from '@/components/ui/bits';
import { Button } from '@/components/ui/Button';
import { AccountSheet } from '@/components/shell/AccountSheet';
import { GetAppButton } from '@/pwa/InstallPrompt';

/** The address the website publishes in its footer — the only contact point people are given. */
const CONTACT_EMAIL = 'hello@printair.ph';

/**
 * Header links: the headline face at a calm weight, near-black, with an ink underline that draws in
 * from the left on hover — the same gesture as the highlighter stroke under "printing." in the hero.
 */
const NAV_LINK =
  "relative whitespace-nowrap rounded-full px-3.5 py-2 font-display text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink-800 transition-colors hover:text-ink-950 " +
  "after:absolute after:inset-x-3.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-magenta-500 after:transition-transform after:duration-300 hover:after:scale-x-100 motion-reduce:after:transition-none";

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
          <nav className="mr-3 hidden items-center gap-0.5 md:flex" aria-label="Sections">
            {/* In-page sections, as on the website. "/#how" works from any page, and the landing page
                scrolls to the hash itself after a client-side navigation. */}
            <Link to="/#how" className={`${NAV_LINK} hidden lg:block`}>
              How it works
            </Link>
            <Link to="/#inspiration" className={`${NAV_LINK} hidden lg:block`}>
              Inspiration
            </Link>
            <Link to="/partners" className={NAV_LINK}>
              Printing partners
            </Link>
            <Link to="/designers" className={NAV_LINK}>
              Designers
            </Link>
            <GetAppButton className="ml-2 inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 font-display text-[0.9375rem] font-semibold tracking-[-0.01em] text-magenta-700 ring-1 ring-inset ring-magenta-300 transition-colors hover:bg-magenta-50 hover:ring-magenta-400" />
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
  const navigate = useNavigate();
  const openJoinPartner = () => navigate('/signup?role=partner');
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
          <p className="slug text-white/60">Explore</p>
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
            <a href="/#builder" className={link}>
              Project builder
            </a>
            <a href="/#inspiration" className={link}>
              Inspiration
            </a>
            <GetAppButton className={`${link} flex items-center gap-2 text-left`} />
          </div>
        </div>
        <div>
          <p className="slug text-white/60">Work with us</p>
          <div className="mt-3">
            <button type="button" onClick={openJoinPartner} className={`${link} text-left`}>
              Join as a Printing Partner
            </button>
            <Link to="/design" className={link}>
              Apply as a designer
            </Link>
          </div>
          <div className="mt-4 space-y-2 text-sm text-white/60">
            <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-2 hover:text-white">
              <Mail className="h-4 w-4 text-white/40" /> {CONTACT_EMAIL}
            </a>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-white/40" /> Metro Manila, Philippines
            </p>
          </div>
        </div>
      </div>
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-white/10 px-5 py-6 sm:px-8">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
          <span>&copy; {new Date().getFullYear()} PrintAir. Your AI Printing Partner.</span>
          <span>Made in the Philippines</span>
          <Link to="/privacy" className="underline-offset-4 hover:text-white hover:underline">
            Privacy
          </Link>
          <Link to="/terms" className="underline-offset-4 hover:text-white hover:underline">
            Terms
          </Link>
        </p>
        <ColorBar size="h-2 w-5" />
      </div>
      <div className="pb-safe" />
    </footer>
  );
}
