import { useState } from 'react';
import { useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, MailCheck, ShoppingBag, Printer, Palette, UserCheck } from 'lucide-react';
import { Logo, ColorBar } from '@/components/ui/Marks';
import { Button, ButtonLink } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowSkin } from '@/lib/look';
import { emailExists, signUpCustomer, signUpPartner, signUpDesigner } from '@/lib/api/auth';
import { isValidEmail, isValidMobile, isSecurePassword, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { describeSignupError, isDuplicateEmailError } from '@/components/auth/errors';
import { specialtiesForCapabilities, bioForCapabilities } from '@/delight/designNeeds';
import {
  CustomerSignupStep,
  PartnerAccountStep,
  PartnerBusinessStep,
  DesignerAccountStep,
  DesignerProfileStep,
} from '@/components/auth/steps';

/**
 * Signing up has its own address, deliberately apart from signing in.
 *
 * The sheet used to do both behind one "Log in or sign up" heading, and people
 * came away unsure which had happened — the two paths looked identical until
 * the very last screen. Here the page only ever creates accounts: the word
 * "sign up" is the heading, the button and the address bar, and the only route
 * to signing in is an explicit link out.
 *
 * Roles are picked first rather than inferred. A printing partner and a
 * designer are signing up to be listed and reviewed, not to buy anything, so
 * they answer different questions; asking once at the top is clearer than
 * discovering it three screens in.
 */

type Role = 'customer' | 'partner' | 'designer';
type Step = 'role' | 'email' | 'taken' | 'form' | 'form-2' | 'sent';

const ROLES: { id: Role; icon: typeof ShoppingBag; title: string; blurb: string }[] = [
  { id: 'customer', icon: ShoppingBag, title: 'I need something printed', blurb: 'Post a project, compare quotations, track it to delivery.' },
  { id: 'partner', icon: Printer, title: 'I run a printing business', blurb: 'Quote on jobs near you and take on new customers.' },
  { id: 'designer', icon: Palette, title: 'I design for print', blurb: 'Apply to take on design work. Reviewed before you start.' },
];

/** Where each role lands once there is a session to land with. */
const HOME: Record<Role, string> = {
  customer: '/dashboard?new=1',
  partner: '/partner',
  designer: '/designer',
};

export default function SignUpPage() {
  const { session, openSignIn, refreshProfile } = useAuth();
  // Signing up is one of the guided flows that wear the website's Classic look
  // (docs/DESIGN-SYSTEM.md, "Skins"). The sign-in sheet already does this; a
  // page that didn't looked like a different product from the sheet it links to.
  const skin = useFlowSkin();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // /signup?role=partner comes from the "Join as a Printing Partner" rows, so
  // someone who already said what they are does not get asked again.
  const presetRole = params.get('role');
  const initialRole: Role | null =
    presetRole === 'partner' || presetRole === 'designer' || presetRole === 'customer' ? presetRole : null;

  // The sign-in sheet sends people here with their address already typed.
  const [role, setRole] = useState<Role | null>(initialRole);
  const [step, setStep] = useState<Step>(initialRole ? 'email' : 'role');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [applicationNote, setApplicationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nobody needs a second account. Someone who is already signed in and lands
  // here — a stale tab, a bookmarked link — goes where they were going.
  if (session) return <Navigate to="/dashboard" replace />;

  const toggleCategory = (id: string) =>
    setCategories((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const addService = (name: string) =>
    setServices((list) => (list.some((s) => s.toLowerCase() === name.toLowerCase()) ? list : [...list, name]));
  const removeService = (name: string) => setServices((list) => list.filter((s) => s !== name));
  const toggleCapability = (id: string) =>
    setCapabilities((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const addSkill = (name: string) =>
    setCustomSkills((list) => (list.some((s) => s.toLowerCase() === name.toLowerCase()) ? list : [...list, name]));
  const removeSkill = (name: string) => setCustomSkills((list) => list.filter((s) => s !== name));

  function chooseRole(r: Role) {
    setRole(r);
    setError(null);
    setStep('email');
  }

  /**
   * The address is checked before any form is filled in. Finding out that you
   * already have an account after typing a business name, a city and five
   * categories is the kind of thing that makes people give up.
   */
  async function handleEmailContinue() {
    setError(null);
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      if (await emailExists(email)) {
        setStep('taken');
        return;
      }
      setStep('form');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Every signup ends here, and the branch is the whole point.
   *
   * supabase.auth.signUp returns a session only while email confirmation is
   * switched off. With it on, the account exists but nobody is signed in — so
   * sending them to a dashboard just bounces them back to a login prompt with
   * no explanation, which is exactly the "did that work?" the old flow caused.
   * Session present: go in. Session absent: say an email is on its way.
   */
  function settle(newSession: unknown, forRole: Role) {
    if (newSession) {
      void refreshProfile();
      navigate(HOME[forRole]);
      return;
    }
    setStep('sent');
  }

  async function submitCustomer() {
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
      const { session: s } = await signUpCustomer({ email, password, firstName, lastName, mobile: mobile || undefined });
      settle(s, 'customer');
    } catch (e) {
      if (isDuplicateEmailError(e)) setStep('taken');
      else setError(describeSignupError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function partnerAccountContinue() {
    setError(null);
    if (!contactName.trim()) {
      setError('Enter your name.');
      return;
    }
    if (!isSecurePassword(password)) {
      setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setStep('form-2');
  }

  async function submitPartner() {
    setError(null);
    if (!businessName.trim()) {
      setError('Enter your printing business name.');
      return;
    }
    if (!city.trim()) {
      setError('Enter your city.');
      return;
    }
    if (mobile.trim() && !isValidMobile(mobile)) {
      setError('Enter a valid Philippine mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSubmitting(true);
    try {
      const { session: s } = await signUpPartner({ email, password, contactName, businessName, city, mobile: mobile || undefined, categories, services });
      settle(s, 'partner');
    } catch (e) {
      if (isDuplicateEmailError(e)) setStep('taken');
      else setError(describeSignupError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function designerAccountContinue() {
    setError(null);
    if (!displayName.trim()) {
      setError('Enter the name customers will see.');
      return;
    }
    if (!isSecurePassword(password)) {
      setError(`Use a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setStep('form-2');
  }

  async function submitDesigner() {
    setError(null);
    if (!city.trim()) {
      setError('Enter your city.');
      return;
    }
    if (capabilities.length === 0 && customSkills.length === 0) {
      setError('Pick at least one kind of design work — this is how work gets matched to you.');
      return;
    }
    // Custom skills alone cannot be matched by the backend; product graphics is
    // the broad specialty, and the bio carries what they actually wrote.
    const specialties = specialtiesForCapabilities(capabilities);
    if (specialties.length === 0) specialties.push('product-graphics');
    if (mobile.trim() && !isValidMobile(mobile)) {
      setError('Enter a valid Philippine mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSubmitting(true);
    try {
      const { session: s } = await signUpDesigner({ email, password, displayName, city, mobile: mobile || undefined, bio: bioForCapabilities(capabilities, customSkills) || undefined, applicationNote: applicationNote || undefined, specialties });
      settle(s, 'designer');
    } catch (e) {
      if (isDuplicateEmailError(e)) setStep('taken');
      else setError(describeSignupError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-paper-200 px-4 py-10 ${skin}`}>
      <span data-ornament className="pointer-events-none absolute -left-10 top-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-cyan-300/50" aria-hidden="true" />
      <span data-ornament className="pointer-events-none absolute -right-10 bottom-10 h-56 w-56 bg-halftone-lg bg-dots-lg text-magenta-300/50" aria-hidden="true" />

      <Link to="/" className="relative" aria-label="PrintAir home">
        <Logo />
      </Link>

      <div data-sheet className="relative mt-8 w-full max-w-md animate-fade-up rounded-4xl bg-white px-5 py-8 shadow-lift ring-1 ring-ink-900/5 sm:px-8 sm:py-10">
        {step === 'role' && <RoleStep onChoose={chooseRole} />}

        {step === 'email' && (
          <SignUpEmailStep
            email={email}
            setEmail={setEmail}
            onContinue={handleEmailContinue}
            onBack={initialRole ? undefined : () => setStep('role')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'taken' && (
          <TakenStep
            email={email}
            onSignIn={() => {
              navigate('/');
              openSignIn();
            }}
            onDifferent={() => {
              setEmail('');
              setError(null);
              setStep('email');
            }}
          />
        )}

        {step === 'form' && role === 'customer' && (
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
            onSubmit={submitCustomer}
            onBack={() => setStep('email')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'form' && role === 'partner' && (
          <PartnerAccountStep
            email={email}
            contactName={contactName}
            setContactName={setContactName}
            password={password}
            setPassword={setPassword}
            onContinue={partnerAccountContinue}
            onBack={() => setStep('email')}
            error={error}
          />
        )}

        {step === 'form-2' && role === 'partner' && (
          <PartnerBusinessStep
            businessName={businessName}
            setBusinessName={setBusinessName}
            city={city}
            setCity={setCity}
            mobile={mobile}
            setMobile={setMobile}
            categories={categories}
            toggleCategory={toggleCategory}
            services={services}
            addService={addService}
            removeService={removeService}
            onSubmit={submitPartner}
            onBack={() => setStep('form')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'form' && role === 'designer' && (
          <DesignerAccountStep
            email={email}
            displayName={displayName}
            setDisplayName={setDisplayName}
            password={password}
            setPassword={setPassword}
            onContinue={designerAccountContinue}
            onBack={() => setStep('email')}
            error={error}
          />
        )}

        {step === 'form-2' && role === 'designer' && (
          <DesignerProfileStep
            city={city}
            setCity={setCity}
            mobile={mobile}
            setMobile={setMobile}
            capabilities={capabilities}
            toggleCapability={toggleCapability}
            customSkills={customSkills}
            addSkill={addSkill}
            removeSkill={removeSkill}
            applicationNote={applicationNote}
            setApplicationNote={setApplicationNote}
            onSubmit={submitDesigner}
            onBack={() => setStep('form')}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'sent' && <SentStep email={email} role={role} />}
      </div>

      {step !== 'sent' && (
        <p className="relative mt-6 text-center text-ink-600">
          Already have an account?{' '}
          <button
            type="button"
            className="font-bold text-ink-900 underline decoration-2 underline-offset-4"
            onClick={() => {
              navigate('/');
              openSignIn();
            }}
          >
            Log in
          </button>
        </p>
      )}
    </div>
  );
}

function RoleStep({ onChoose }: { onChoose: (r: Role) => void }) {
  return (
    <div className="animate-fade-up">
      <ColorBar />
      <h1 className="mt-6 text-3xl text-ink-950">Create your account</h1>
      <p className="mt-2 text-ink-600">First — which of these is you?</p>
      <div className="mt-7 space-y-3">
        {ROLES.map(({ id, icon: Icon, title, blurb }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChoose(id)}
            data-option
            className="group flex w-full items-start gap-4 rounded-3xl bg-paper-100 p-4 text-left ring-1 ring-ink-900/5 transition hover:bg-paper-200"
          >
            <span data-option-icon className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-ink-900 ring-1 ring-ink-900/5">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink-900">{title}</span>
              <span data-option-sub className="mt-0.5 block text-sm text-ink-600">{blurb}</span>
            </span>
            <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-1" />
          </button>
        ))}
      </div>
    </div>
  );
}

function SignUpEmailStep({
  email,
  setEmail,
  onContinue,
  onBack,
  submitting,
  error,
}: {
  email: string;
  setEmail: (v: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="animate-fade-up">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> Choose a different account type
        </button>
      )}
      <ColorBar />
      <h1 className="mt-6 text-3xl text-ink-950">Sign up</h1>
      <p className="mt-2 text-ink-600">We&apos;ll check this address isn&apos;t already taken before you fill anything in.</p>
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
      </form>
      <p className="mt-5 text-xs text-ink-500">
        By signing up you agree to our <Link to="/terms" className="font-bold underline underline-offset-2">Terms</Link> and{' '}
        <Link to="/privacy" className="font-bold underline underline-offset-2">Privacy Policy</Link>.
      </p>
    </div>
  );
}

/**
 * The dead end that should not feel like one. An address that already has an
 * account is not an error the person made — it is almost always them, earlier.
 * So this leads with who they are and offers the way through.
 */
function TakenStep({ email, onSignIn, onDifferent }: { email: string; onSignIn: () => void; onDifferent: () => void }) {
  return (
    <div className="animate-fade-up text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sun-200 text-ink-950">
        <UserCheck className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl text-ink-950">You&apos;re already with us</h1>
      <p className="mt-3 text-ink-600">
        <b className="break-all font-bold text-ink-900">{email}</b> already has a PrintAir account. Log in and everything you&apos;ve done is still there.
      </p>
      <Button variant="primary" size="lg" fullWidth className="mt-7" onClick={onSignIn}>
        Log in instead
      </Button>
      <Button variant="secondary" size="lg" fullWidth className="mt-3" onClick={onDifferent}>
        Use a different email
      </Button>
    </div>
  );
}

/**
 * Only reached when signUp came back without a session, which means email
 * confirmation is on and the account is real but dormant. Saying so plainly is
 * the entire fix for "I'm not sure whether I signed up at all".
 */
function SentStep({ email, role }: { email: string; role: Role | null }) {
  return (
    <div className="animate-fade-up text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-300 text-ink-950">
        <MailCheck className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl text-ink-950">Check your email</h1>
      <p className="mt-3 text-ink-600">
        Your account is created. We&apos;ve sent a confirmation link to <b className="break-all font-bold text-ink-900">{email}</b> — open it and you&apos;re in.
      </p>
      {role === 'designer' && (
        <p className="mt-3 text-sm text-ink-500">Once confirmed, your application goes to our team for review before work can start.</p>
      )}
      <p className="mt-5 text-sm text-ink-500">Nothing arrived after a few minutes? Check your spam folder.</p>
      <ButtonLink to="/" variant="secondary" size="lg" fullWidth className="mt-7">
        Back to PrintAir
      </ButtonLink>
    </div>
  );
}
