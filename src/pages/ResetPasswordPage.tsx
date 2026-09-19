import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Link2Off, Lock } from 'lucide-react';
import { Logo, ColorBar } from '@/components/ui/Marks';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { resetPassword } from '@/lib/api/auth';
import { isSecurePassword, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { supabase } from '@/lib/api/client';

/**
 * Reached from the "reset your password" email link. Supabase puts a
 * recovery session in the URL fragment automatically (detectSessionInUrl),
 * so by the time this renders we're briefly authenticated as the account
 * whose password is being reset — enough to call updateUser().
 *
 * getSession() alone isn't enough to gate the form: it returns true for
 * *any* active session, including an ordinary pre-existing login with no
 * recovery token in the URL at all (e.g. someone navigating here directly,
 * or clicking a stale/foreign reset link while still signed in elsewhere).
 * Requiring `type=recovery` in the URL fragment first, and preferring the
 * PASSWORD_RECOVERY auth event, keeps this scoped to a real recovery flow.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!/type=recovery/.test(window.location.hash)) {
      setReady(false);
      return;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // The event may already have fired before this listener attached
    // (supabase-js processes the URL on client init, before React mounts).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSecurePassword(password)) {
      setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(password);
      setDone(true);
    } catch {
      setError('That reset link has expired. Request a new one and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-paper-200 px-4 py-10">
      <span className="pointer-events-none absolute -left-10 top-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-cyan-300/50" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-10 bottom-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-magenta-300/50" aria-hidden="true" />

      <Logo className="relative" />

      <div className="relative mt-8 w-full max-w-md animate-fade-up rounded-4xl bg-white px-5 py-8 shadow-lift ring-1 ring-ink-900/5 sm:px-8 sm:py-10">
        {done ? (
          <div className="text-center">
            <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-leaf-300" aria-hidden="true" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-leaf-400 text-ink-950">
                <Check className="h-9 w-9" strokeWidth={3} />
              </span>
            </span>
            <h1 className="mt-6 text-3xl text-ink-950">Password updated</h1>
            <p className="mt-2 text-ink-600">You can now sign in with your new password.</p>
            <Button variant="primary" size="lg" fullWidth className="mt-7" onClick={() => navigate('/')}>
              Back to PrintAir
            </Button>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 -rotate-6 items-center justify-center rounded-3xl bg-sun-200 text-ink-950">
              <Link2Off className="h-8 w-8" strokeWidth={1.75} />
            </span>
            <h1 className="mt-6 text-3xl text-ink-950">This link is invalid or has expired.</h1>
            <p className="mt-2 text-ink-600">Return home and request a new one.</p>
            <Button variant="primary" size="lg" fullWidth className="mt-7" onClick={() => navigate('/')}>
              Return home
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl text-ink-950">Choose a new password</h1>
            <p className="mt-2 text-ink-600">Use at least {MIN_PASSWORD_LENGTH} characters, then type it once more to be sure.</p>
            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <PasswordField label="New password" value={password} onChange={setPassword} />
              <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} />
              <FormError>{error}</FormError>
              <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
                Update password
              </Button>
            </form>
          </>
        )}
      </div>

      <ColorBar className="relative mt-10" />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return <TextField icon={Lock} type="password" autoComplete="new-password" label={label} value={value} onChange={onChange} />;
}
