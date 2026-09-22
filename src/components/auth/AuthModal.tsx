import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlowSkin } from '@/lib/look';
import { UserPlus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { emailExists, signIn, requestPasswordReset } from '@/lib/api/auth';
import { isValidEmail } from '@/lib/validation';
import { EmailStep, PasswordStep, ResetRequestStep, ResetSentStep } from './steps';

/**
 * The sign-in sheet. It no longer creates accounts.
 *
 * It used to do both, and the two were indistinguishable until the last screen
 * — people finished unsure whether they had just signed up or just logged in.
 * Creating an account now lives at /signup, which says so in the heading, the
 * button and the address bar. This sheet only ever gets someone back in.
 *
 * It still opens over whatever the person was doing, which is the reason to
 * keep it a sheet: signing in from step 6 of the project builder must not
 * unmount the builder and lose six answers.
 */

type Step = 'email' | 'no-account' | 'password' | 'reset-request' | 'reset-sent';

export function AuthModal() {
  const { authModal, authStayPut, closeAuthModal, refreshProfile } = useAuth();
  const skin = useFlowSkin();
  const navigate = useNavigate();
  const open = authModal !== 'closed';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState('');

  /**
   * A safety net, not a route anyone should take.
   *
   * openJoinPartner and openJoinDesigner live in AuthContext, which is carried
   * over from the website and frozen, so they still exist and still set these
   * modes. Every caller now goes straight to /signup instead — but if one is
   * ever missed, or added later from the website's copy, this sends it there
   * rather than opening a sheet that can no longer sign anyone up.
   */
  useEffect(() => {
    if (authModal === 'join-partner' || authModal === 'join-designer') {
      const role = authModal === 'join-partner' ? 'partner' : 'designer';
      closeAuthModal();
      navigate(`/signup?role=${role}`);
    }
  }, [authModal, closeAuthModal, navigate]);

  useEffect(() => {
    if (open) reset();
  }, [open]);

  function reset() {
    setStep('email');
    setEmail('');
    setPassword('');
    setError(null);
    setSubmitting(false);
  }

  function handleClose() {
    closeAuthModal();
    setTimeout(reset, 300);
  }

  function redirectAfterAuth(role: 'customer' | 'partner' | 'designer' | 'admin') {
    handleClose();
    // Opened from mid-task (the project builder): the caller is still mounted
    // behind this modal and re-renders itself now that a session exists.
    // Navigating would unmount it and discard everything already answered.
    if (authStayPut) return;
    if (role === 'partner') navigate('/partner');
    else if (role === 'designer') navigate('/designer');
    else if (role === 'admin') navigate('/admin');
    else navigate('/dashboard');
  }

  /**
   * An address with no account used to drop silently into a signup form. Now it
   * says so and hands over to the signup page, carrying the address so it does
   * not have to be typed twice.
   */
  async function handleEmailContinue() {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      setStep((await emailExists(email)) ? 'password' : 'no-account');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit() {
    setError(null);
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await signIn(email, password);
      await refreshProfile();
      const role = (user?.user_metadata?.role as string) ?? 'customer';
      redirectAfterAuth(role as 'customer' | 'partner' | 'designer' | 'admin');
    } catch {
      setError('That email and password don’t match. Try again, or reset your password.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReset() {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setResetSentTo(email);
      setStep('reset-sent');
    } catch {
      setError('Something went wrong sending the reset link. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} size="sm" labelledBy="auth-title" skin={skin}>
      <div className="px-5 pb-8 pt-5 sm:px-8 sm:pb-9 sm:pt-7">
        {step === 'email' && (
          <EmailStep
            mode="sign-in"
            email={email}
            setEmail={setEmail}
            onContinue={handleEmailContinue}
            submitting={submitting}
            error={error}
            onLegal={handleClose}
          />
        )}

        {step === 'no-account' && (
          <NoAccountStep
            email={email}
            onSignUp={() => {
              handleClose();
              navigate(`/signup?email=${encodeURIComponent(email)}`);
            }}
            onDifferent={() => {
              setEmail('');
              setError(null);
              setStep('email');
            }}
          />
        )}

        {step === 'password' && (
          <PasswordStep
            email={email}
            password={password}
            setPassword={setPassword}
            onSubmit={handlePasswordSubmit}
            onForgot={() => {
              setError(null);
              setStep('reset-request');
            }}
            onBack={() => setStep('email')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'reset-request' && (
          <ResetRequestStep
            email={email}
            setEmail={setEmail}
            onSend={handleSendReset}
            onBack={() => setStep('password')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'reset-sent' && <ResetSentStep email={resetSentTo} onClose={handleClose} />}
      </div>
    </Sheet>
  );
}

function NoAccountStep({ email, onSignUp, onDifferent }: { email: string; onSignUp: () => void; onDifferent: () => void }) {
  return (
    <div className="animate-fade-up text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-paper-200 text-ink-900">
        <UserPlus className="h-7 w-7" />
      </span>
      <h2 id="auth-title" className="mt-6 text-3xl text-ink-950">
        No account yet
      </h2>
      <p className="mt-3 text-ink-600">
        Nothing is registered to <b className="break-all font-bold text-ink-900">{email}</b>. Signing up takes about a minute.
      </p>
      <Button variant="primary" size="lg" fullWidth className="mt-7" onClick={onSignUp}>
        Sign up with this email
      </Button>
      <Button variant="secondary" size="lg" fullWidth className="mt-3" onClick={onDifferent}>
        Try a different email
      </Button>
    </div>
  );
}
