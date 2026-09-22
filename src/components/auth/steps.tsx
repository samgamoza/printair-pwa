/**
 * The account step screens, shared by the two places that show them.
 *
 * AuthModal is a sheet and now only signs people in. SignUpPage is a full page
 * and handles all three roles. Both render the steps below, so they live here
 * rather than in either caller: a change to the password rule or the partner
 * categories then reaches both at once instead of drifting.
 *
 * Every step is presentational. State, validation and submission stay with the
 * caller, which is what lets the same partner form serve a sheet and a page.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, MailCheck, Lock, User, Building2, MapPin, Phone, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextField, TextAreaField, Field, Chip } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { LogoMark, ColorBar } from '@/components/ui/Marks';
import { MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { CATEGORIES, DESIGN_NEEDS } from '@/data/catalog';

const SERVICE_CATEGORIES = CATEGORIES.filter((c) => !c.isSpecial);

/* ---------------- Shared step furniture ---------------- */

/**
 * The top of every step: the way back (where the step has one), the heading
 * the sheet is labelled by, and one line of helper copy. The back control
 * keeps its wording from the step it belongs to ("Use a different email",
 * "Back", "Back to log in") so it says where it goes, not just "back".
 */
export function StepHeader({
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
export function EmailLine({ lead, email }: { lead: string; email: string }) {
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

export function DesignerAccountStep({
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

export function DesignerProfileStep({
  city,
  setCity,
  mobile,
  setMobile,
  capabilities,
  toggleCapability,
  customSkills,
  addSkill,
  removeSkill,
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
  /**
   * What the designer makes, in the same words customers use to ask for it
   * (DESIGN_NEEDS). The four backend specialties are derived from these by the
   * caller; the full list, plus anything typed under "More", becomes the bio.
   */
  capabilities: string[];
  toggleCapability: (id: string) => void;
  customSkills: string[];
  addSkill: (name: string) => void;
  removeSkill: (name: string) => void;
  applicationNote: string;
  setApplicationNote: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const name = draft.trim();
    if (!name) return;
    addSkill(name);
    setDraft('');
  }

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

        <Field label="What you design" hint="Pick everything you take on. Customers see this list on your profile.">
          <div className="flex flex-wrap gap-2">
            {DESIGN_NEEDS.filter((n) => n.id !== 'other').map((n) => (
              <Chip key={n.id} selected={capabilities.includes(n.id)} onClick={() => toggleCapability(n.id)} title={n.tagline}>
                {n.name}
              </Chip>
            ))}
            {customSkills.map((name) => (
              <Chip key={name} selected onClick={() => removeSkill(name)} title="Remove">
                {name} <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Chip>
            ))}
            <Chip selected={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> More
            </Chip>
          </div>
          {moreOpen && (
            <div className="mt-3 flex gap-2 animate-fade-up">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="e.g. Hand-lettering, calendars, photo books"
                aria-label="Another kind of design work"
                className="control flex-1"
                autoFocus
              />
              <Button type="button" variant="secondary" onClick={commitDraft} disabled={!draft.trim()}>
                Add
              </Button>
            </div>
          )}
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

/* ---------------- Steps ---------------- */

export function EmailStep({
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

export function PasswordStep({
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

export function CustomerSignupStep({
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

export function PartnerAccountStep({
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

export function PartnerBusinessStep({
  businessName,
  setBusinessName,
  city,
  setCity,
  mobile,
  setMobile,
  categories,
  toggleCategory,
  services,
  addService,
  removeService,
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
  /**
   * Services the applicant typed in because none of the listed categories fit —
   * "risograph", "large-format tarpaulin", "foil stamping". Stored on the partner
   * profile as `services`, which the backend has always accepted alongside
   * `categories`; this is the first screen to actually fill it in.
   */
  services: string[];
  addService: (name: string) => void;
  removeService: (name: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const name = draft.trim();
    if (!name) return;
    addService(name);
    setDraft('');
  }

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

        <Field label="Main printing services" hint="Pick all that apply. Not listed? Add your own.">
          <div className="flex flex-wrap gap-2">
            {SERVICE_CATEGORIES.map((cat) => (
              <Chip key={cat.id} selected={categories.includes(cat.id)} onClick={() => toggleCategory(cat.id)}>
                {cat.name}
              </Chip>
            ))}
            {services.map((name) => (
              <Chip key={name} selected onClick={() => removeService(name)} title="Remove">
                {name} <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Chip>
            ))}
            <Chip selected={otherOpen} onClick={() => setOtherOpen((o) => !o)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Other
            </Chip>
          </div>
          {otherOpen && (
            <div className="mt-3 flex gap-2 animate-fade-up">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the service; it must not submit the whole form.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                placeholder="e.g. Risograph, foil stamping"
                aria-label="Another printing service"
                className="control flex-1"
                autoFocus
              />
              <Button type="button" variant="secondary" onClick={commitDraft} disabled={!draft.trim()}>
                Add
              </Button>
            </div>
          )}
        </Field>

        <FormError>{error}</FormError>
        <Button type="submit" variant="accent" size="lg" fullWidth loading={submitting}>
          Create partner account
        </Button>
      </form>
    </div>
  );
}

export function ResetRequestStep({
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

export function ResetSentStep({ email, onClose }: { email: string; onClose: () => void }) {
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
