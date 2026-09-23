import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleUserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/Marks';
import { Avatar } from '@/components/ui/bits';
import { AccountSheet } from './AccountSheet';

/**
 * Frame for pages anyone can open: directories, public profiles, checkout.
 *
 * An installed app has no browser back button, so every one of these pages
 * carries its own way back.
 */
export function PublicShell({
  children,
  back,
  width = 'max-w-5xl',
}: {
  children: ReactNode;
  /** Where the back arrow goes. Falls back to browser history, then home. */
  back?: { to: string; label: string };
  width?: string;
}) {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-paper-200">
      <header className="sticky top-0 z-30 border-b border-ink-900/5 bg-paper-200/85 backdrop-blur-xl">
        <div className="pt-safe">
          <div className={`mx-auto flex h-14 items-center gap-2 px-4 sm:h-16 sm:px-8 ${width}`}>
            <button
              type="button"
              aria-label={back ? back.label : 'Back'}
              onClick={() => (back ? navigate(back.to) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link to="/" className="mr-auto">
              <Logo size="h-10" />
            </Link>
            <button type="button" onClick={() => setAccountOpen(true)} aria-label="Account" className="rounded-full active:scale-95">
              {session && profile ? (
                <Avatar name={profile.full_name} className="h-9 w-9 text-xs" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 text-ink-700">
                  <CircleUserRound className="h-5 w-5" />
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto w-full px-5 pb-16 pt-6 sm:px-8 sm:pt-10 ${width}`}>{children}</main>
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
