import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFlowSkin } from '@/lib/look';
import { ArrowLeft, ArrowRight, Mail, MailCheck, Lock, User, Building2, MapPin, Phone } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextField, TextAreaField, Field, Chip } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { LogoMark, ColorBar } from '@/components/ui/Marks';
import { useAuth } from '@/contexts/AuthContext';
import { emailExists, signIn, signUpCustomer, signUpPartner, signUpDesigner, requestPasswordReset } from '@/lib/api/auth';
import { isValidEmail, isValidMobile, isSecurePassword, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { CATEGORIES, DESIGN_SPECIALTIES } from '@/data/catalog';

type Step =
  | 'email'
  | 'password'
  | 'customer-signup'
  | 'partner-account'
  | 'partner-business'
  | 'designer-account'
  | 'designer-profile'
  | 'reset-request'
  | 'reset-sent';

const SERVICE_CATEGORIES = CATEGORIES.filter((c) => !c.isSpecial);

export function AuthModal() {
  const { authModal, authStayPut, closeAuthModal, refreshProfile } = useAuth();
  const skin = useFlowSkin();
  const navigate = useNavigate();
  const open = authModal !== 'closed';
  const mode: 'sign-in' | 'join-partner' | 'join-designer' =
    authModal === 'join-partner' ? 'join-partner' : authModal === 'join-designer' ? 'join-designer' : 'sign-in';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [applicationNote, setApplicationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState('');

  useEffect(() => {
    if (open) reset();
  }, [open, mode]);

  function reset() {
    setStep('email');
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setMobile('');
    setContactName('');
    setBusinessName('');
    setCity('');
    setCategories([]);
    setDisplayName('');
    setSpecialties([]);
    setApplicationNote('');
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

  async function handleEmailContinue() {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const exists = await emailExists(email);
      if (exists) {
        setStep('password');
      } else if (mode === 'join-partner') {
        setStep('partner-account');
      } else if (mode === 'join-designer') {
        setStep('designer-account');
      } else {
        setStep('customer-signup');
      }
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

  async function handleCustomerSignup() {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name.');
      return;
    }
    if (!isSecurePassword(password)) {
      setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (mobile.trim() && !isValidMobile(mobile)) {
      setError('Enter a valid Philippine mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSubmitting(true);
    try {
      const { session: newSession } = await signUpCustomer({
        email,
        password,
        firstName,
        lastName,
        mobile: mobile || undefined,
      });
      await refreshProfile();
      handleClose();
      // Someone who signed up mid-build already answered "what would you like
      // to print?" — sending them to the dashboard's fresh builder made them
      // redo the whole questionnaire. Leave them where they were; the builder
      // re-renders itself now that a session exists.
      //
      // Guarded on an actual session: signUp only returns one while email
      // confirmation is disabled. If that is ever turned on, fall through to
      // the redirect rather than stranding the user on the sign-in prompt.
      if (authStayPut && newSession) return;
      // Fresh customer accounts land straight on "what would you like to print?"
      navigate('/dashboard?new=1');
    } catch (e) {
      setError(describeSignupError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handlePartnerAccountContinue() {
    setError(null);
    if (!contactName.trim()) {
      setError('Enter your name.');
      return;
    }
    if (!isSecurePassword(password)) {
      setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setStep('partner-business');
  }

  async function handlePartnerSignup() {
    setError(null);
    if (!businessName.trim()) {
      setError('Enter your printing business name.');
      return;
    }
    if (!city.trim()) {
      setError('Enter your city.');
      return;
    }
    if (!isValidMobile(mobile)) {
      setError('Enter a valid Philippine mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSubmitting(true);
    try {
      await signUpPartner({
        email,
        password,
        contactName,
        businessName,
        city,
        mobile: mobile || undefined,
        categories,
      });
      await refreshProfile();
      redirectAfterAuth('partner');
    } catch (e) {
      setError(describeSignupError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleDesignerAccountContinue() {
    setError(null);
    if (!displayName.trim()) {
      setError('Enter the name customers will see.');
      return;
    }
    if (!isSecurePassword(password)) {
      setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setStep('designer-profile');
  }

  function toggleSpecialty(id: string) {
    setSpecialties((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleDesignerSignup() {
    setError(null);
    if (!city.trim()) {
      setError('Enter your city.');
      return;
    }
    if (specialties.length === 0) {
      setError('Choose at least one specialty — this is how work gets matched to you.');
      return;
    }
    if (!isValidMobile(mobile)) {
      setError('Enter a valid Philippine mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSubmitting(true);
    try {
      await signUpDesigner({
        email,
        password,
        displayName,
        city,
        mobile: mobile || undefined,
        applicationNote: applicationNote || undefined,
        specialties,
      });
      await refreshProfile();
      // Straight into the designer area, which shows the pending-review state.
      // Signing up here is submitting an application, not joining, and the
      // page there says so rather than implying work can start.
      redirectAfterAuth('designer');
    } catch (e) {
      setError(describeSignupError(e));
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

  const toggleCategory = (id: string) => {
    setCategories((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  return (
    <Sheet open={open} onClose={handleClose} size="sm" labelledBy="auth-title" skin={skin}>
      <div className="px-5 pb-8 pt-5 sm:px-8 sm:pb-9 sm:pt-7">
        {step === 'email' && (
          <EmailStep
            mode={mode}
            email={email}
            setEmail={setEmail}
            onContinue={handleEmailContinue}
            submitting={submitting}
            error={error}
            onLegal={handleClose}
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

        {step === 'customer-signup' && (
          <CustomerSignupStep
            email={email}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            password={password}
            setPassword={setPassword}
            mobile={mobile}
            setMobile={setMobile}
            onSubmit={handleCustomerSignup}
            onBack={() => setStep('email')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'partner-account' && (
          <PartnerAccountStep
            email={email}
            contactName={contactName}
            setContactName={setContactName}
            password={password}
            setPassword={setPassword}
            onContinue={handlePartnerAccountContinue}
            onBack={() => setStep('email')}
            error={error}
          />
        )}

        {step === 'partner-business' && (
          <PartnerBusinessStep
            businessName={businessName}
            setBusinessName={setBusinessName}
            city={city}
            setCity={setCity}
            mobile={mobile}
            setMobile={setMobile}
            categories={categories}
            toggleCategory={toggleCategory}
            onSubmit={handlePartnerSignup}
            onBack={() => setStep('partner-account')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'designer-account' && (
          <DesignerAccountStep
            email={email}
            displayName={displayName}
            setDisplayName={setDisplayName}
            password={password}
            setPassword={setPassword}
            onContinue={handleDesignerAccountContinue}
            onBack={() => setStep('email')}
            error={error}
          />
        )}

        {step === 'designer-profile' && (
          <DesignerProfileStep
            city={city}
            setCity={setCity}
            mobile={mobile}
            setMobile={setMobile}
            specialties={specialties}
            toggleSpecialty={toggleSpecialty}
            applicationNote={applicationNote}
            setApplicationNote={setApplicationNote}
            onSubmit={handleDesignerSignup}
            onBack={() => setStep('designer-account')}
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

/* ---------------- Shared step furniture ---------------- */

/**
 * The top of every step: the way back (where the step has one), the heading
 * the sheet is labelled by, and one line of helper copy. The back control
 * keeps its wording from the step it belongs to ("Use a different email",
 * "Back", "Back to log in") so it says where it goes, not just "back".
 */
function StepHeader({
  eyebrow,
  title,
  children,
  backLabel,
  onBack,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <>
      {/* pr-12 keeps the row clear of the sheet's own close button. */}
      <div className="flex min-h-11 items-center pr-12">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            {backLabel}
          </button>
        )}
      </div>
      {eyebrow && <p className="slug mt-3 text-magenta-600">{eyebrow}</p>}
      <h2 id="auth-title" className={`${eyebrow ? 'mt-2' : 'mt-3'} text-3xl text-ink-950`}>
        {title}
      </h2>
      {children && <p className="mt-2 text-ink-600">{children}</p>}
    </>
  );
}

/** The address this step is acting on, so nobody fills in a form for a typo. */
function EmailLine({ lead, email }: { lead: string; email: string }) {
  return (
    <>
      {lead} <b className="break-all font-bold text-ink-900">{email}</b>
    </>
  );
}

// A note on every TextField below: autoComplete and name are explicit
// per-field values, not "off". Without these, a bare <input> next to a
// password field reads to Chrome/Edge as an anonymous login form, and
// they'll autofill a saved username/email into whichever text field is
// first — silently overwriting things like "Last name" with garbage.

function DesignerAccountStep({
  email,
  displayName,
  setDisplayName,
  password,
  setPassword,
  onContinue,
  onBack,
  error,
}: {
  email: string;
  displayName: string;
  setDisplayName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader eyebrow="Step 1 of 2" title="Apply as a Designer" backLabel="Use a different email" onBack={onBack}>
        <EmailLine lead="Applying with" email={email} />
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
      >
        <TextField icon={User} name="name" autoComplete="name" label="Name customers will see" placeholder="e.g. Studio Maya" value={displayName} onChange={setDisplayName} autoFocus />
        <TextField icon={Lock} type="password" name="new-password" autoComplete="new-password" label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} value={password} onChange={setPassword} />
        <FormError>{error}</FormError>
        <Button type="submit" variant="primary" size="lg" fullWidth iconRight={<ArrowRight className="h-5 w-5" />}>
          Continue
        </Button>
      </form>
    </div>
  );
}

function DesignerProfileStep({
  city,
  setCity,
  mobile,
  setMobile,
  specialties,
  toggleSpecialty,
  applicationNote,
  setApplicationNote,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  city: string;
  setCity: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  specialties: string[];
  toggleSpecialty: (id: string) => void;
  applicationNote: string;
  setApplicationNote: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader eyebrow="Step 2 of 2" title="Tell us what you design" backLabel="Back" onBack={onBack}>
        Every designer is reviewed by a person before receiving work. You will add portfolio samples next.
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <TextField icon={MapPin} name="address-level2" autoComplete="address-level2" label="City" placeholder="e.g. Quezon City" value={city} onChange={setCity} autoFocus />
        <TextField icon={Phone} type="tel" inputMode="tel" name="tel" autoComplete="tel" label="Mobile number" placeholder="0917 123 4567" value={mobile} onChange={setMobile} />

        <Field label="What you design">
          <div className="flex flex-wrap gap-2">
            {DESIGN_SPECIALTIES.map((s) => (
              <Chip key={s.id} selected={specialties.includes(s.id)} onClick={() => toggleSpecialty(s.id)} title={s.tagline}>
                {s.name}
              </Chip>
            ))}
          </div>
        </Field>

        <TextAreaField
          label="Anything the reviewer should know (optional)"
          value={applicationNote}
          onChange={setApplicationNote}
          rows={2}
          placeholder="e.g. Most of my recent work is dieline-first packaging for local food brands."
        />

        <FormError>{error}</FormError>
        <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting}>
          Submit application
        </Button>
      </form>
    </div>
  );
}

function describeSignupError(e: unknown): string {
  const msg = e instanceof Error ? e.message : '';
  if (/already registered|duplicate|already exists/i.test(msg)) {
    return 'An account with that email already exists. Try logging in instead.';
  }
  if (msg) return msg;
  return 'Something went wrong creating your account. Please try again.';
}

/* ---------------- Steps ---------------- */

function EmailStep({
  mode,
  email,
  setEmail,
  onContinue,
  submitting,
  error,
  onLegal,
}: {
  mode: 'sign-in' | 'join-partner' | 'join-designer';
  email: string;
  setEmail: (v: string) => void;
  onContinue: () => void;
  submitting: boolean;
  error: string | null;
  /** Closes the sheet when someone follows a link to the terms or privacy page. */
  onLegal: () => void;
}) {
  return (
    <div className="animate-fade-up">
      {/* The welcome. pr-12 keeps the mark's row clear of the sheet's close button. */}
      <div className="flex items-center gap-3 pr-12">
        <LogoMark className="h-14 w-14" />
        <ColorBar />
      </div>
      <h2 id="auth-title" className="mt-6 text-3xl text-ink-950">
        {mode === 'join-partner'
          ? 'Join as a Printing Partner'
          : mode === 'join-designer'
            ? 'Apply as a Designer'
            : 'Log in or sign up'}
      </h2>
      <p className="mt-2 text-ink-600">We&apos;ll ask for a password next — no lengthy forms.</p>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
      >
        <TextField icon={Mail} type="email" name="email" autoComplete="email" label="Email address" placeholder="you@example.com" value={email} onChange={setEmail} autoFocus />
        <FormError>{error}</FormError>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Continue
        </Button>
        <p className="text-center text-sm text-ink-500">
          By continuing you agree to PrintAir&apos;s{' '}
          <Link to="/terms" onClick={onLegal} className="font-bold text-ink-700 underline underline-offset-2">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" onClick={onLegal} className="font-bold text-ink-700 underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}

function PasswordStep({
  email,
  password,
  setPassword,
  onSubmit,
  onForgot,
  onBack,
  submitting,
  error,
}: {
  email: string;
  password: string;
  setPassword: (v: string) => void;
  onSubmit: () => void;
  onForgot: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader title="Welcome back" backLabel="Use a different email" onBack={onBack}>
        <EmailLine lead="Logging in as" email={email} />
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <TextField icon={Lock} type="password" name="current-password" autoComplete="current-password" label="Password" value={password} onChange={setPassword} autoFocus />
        <FormError>{error}</FormError>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Log in
        </Button>
      </form>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onForgot}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-magenta-700 transition-colors hover:bg-magenta-50 active:scale-95"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}

function CustomerSignupStep({
  email,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  password,
  setPassword,
  mobile,
  setMobile,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  email: string;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader title="Create your account" backLabel="Use a different email" onBack={onBack}>
        <EmailLine lead="Signing up with" email={email} />
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {/* Side by side even on a phone, so the pair goes without icons to leave room to type. */}
        <div className="grid grid-cols-2 gap-3">
          <TextField name="given-name" autoComplete="given-name" label="First name" value={firstName} onChange={setFirstName} autoFocus />
          <TextField name="family-name" autoComplete="family-name" label="Last name" value={lastName} onChange={setLastName} />
        </div>
        <TextField icon={Lock} type="password" name="new-password" autoComplete="new-password" label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} value={password} onChange={setPassword} />
        <TextField icon={Phone} type="tel" inputMode="tel" name="tel" autoComplete="tel" label="Mobile number (optional)" placeholder="0917 123 4567" value={mobile} onChange={setMobile} />
        <FormError>{error}</FormError>
        <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting}>
          Create account
        </Button>
      </form>
    </div>
  );
}

function PartnerAccountStep({
  email,
  contactName,
  setContactName,
  password,
  setPassword,
  onContinue,
  onBack,
  error,
}: {
  email: string;
  contactName: string;
  setContactName: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  onContinue: () => void;
  onBack: () => void;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader eyebrow="Step 1 of 2" title="Join as a Printing Partner" backLabel="Use a different email" onBack={onBack}>
        <EmailLine lead="Joining with" email={email} />
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
      >
        <TextField icon={User} name="name" autoComplete="name" label="Your name" value={contactName} onChange={setContactName} autoFocus />
        <TextField icon={Lock} type="password" name="new-password" autoComplete="new-password" label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} value={password} onChange={setPassword} />
        <FormError>{error}</FormError>
        <Button type="submit" variant="primary" size="lg" fullWidth iconRight={<ArrowRight className="h-5 w-5" />}>
          Continue
        </Button>
      </form>
    </div>
  );
}

function PartnerBusinessStep({
  businessName,
  setBusinessName,
  city,
  setCity,
  mobile,
  setMobile,
  categories,
  toggleCategory,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  businessName: string;
  setBusinessName: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  categories: string[];
  toggleCategory: (id: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader eyebrow="Step 2 of 2" title="Tell us about your printing business" backLabel="Back" onBack={onBack}>
        You can add your logo, portfolio, and full details later.
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <TextField icon={Building2} name="organization" autoComplete="organization" label="Printing business name" value={businessName} onChange={setBusinessName} autoFocus />
        <TextField icon={MapPin} name="address-level2" autoComplete="address-level2" label="City" placeholder="e.g. Quezon City" value={city} onChange={setCity} />
        <TextField icon={Phone} type="tel" inputMode="tel" name="tel" autoComplete="tel" label="Mobile number" placeholder="0917 123 4567" value={mobile} onChange={setMobile} />

        <Field label="Main printing services">
          <div className="flex flex-wrap gap-2">
            {SERVICE_CATEGORIES.map((cat) => (
              <Chip key={cat.id} selected={categories.includes(cat.id)} onClick={() => toggleCategory(cat.id)}>
                {cat.name}
              </Chip>
            ))}
          </div>
        </Field>

        <FormError>{error}</FormError>
        <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting}>
          Create partner account
        </Button>
      </form>
    </div>
  );
}

function ResetRequestStep({
  email,
  setEmail,
  onSend,
  onBack,
  submitting,
  error,
}: {
  email: string;
  setEmail: (v: string) => void;
  onSend: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeader title="Reset your password" backLabel="Back to log in" onBack={onBack}>
        We&apos;ll email you a reset link.
      </StepHeader>
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <TextField icon={Mail} type="email" name="email" autoComplete="email" label="Email address" placeholder="you@example.com" value={email} onChange={setEmail} autoFocus />
        <FormError>{error}</FormError>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
          Send reset link
        </Button>
      </form>
    </div>
  );
}

function ResetSentStep({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <div className="animate-fade-up">
      <div className="flex min-h-11 items-center pr-12">
        <span className="flex h-16 w-16 -rotate-6 items-center justify-center rounded-3xl bg-cyan-200 text-ink-950">
          <MailCheck className="h-8 w-8" strokeWidth={1.75} />
        </span>
      </div>
      <h2 id="auth-title" className="mt-6 text-3xl text-ink-950">
        Check your email
      </h2>
      <p className="mt-2 text-ink-600">
        If an account exists for <b className="break-all font-bold text-ink-900">{email}</b>, we&apos;ve sent a link to
        reset your password.
      </p>
      <Button variant="secondary" size="lg" fullWidth className="mt-7" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}
