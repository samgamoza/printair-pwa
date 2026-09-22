import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Lightbulb, Palette, RotateCcw, Save, Send, Sparkles } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, TextField, TextAreaField } from '@/components/ui/Field';
import { Dropzone } from '@/components/ui/Dropzone';
import { FileRow } from '@/components/ui/bits';
import { Banner, FormError } from '@/components/ui/states';
import { InkLoader, RegistrationMark } from '@/components/ui/Marks';
import {
  CATEGORIES,
  DIMENSION_AXES,
  DIMENSION_UNITS,
  PACKAGING_TYPES,
  QUANTITY_OPTIONS,
  TIMELINE_OPTIONS,
  dimensionShapeFor,
  type CatalogCategory,
  type DimensionShape,
  type DimensionUnit,
} from '@/data/catalog';
import { useAuth } from '@/contexts/AuthContext';
import { useFlowSkin } from '@/lib/look';
import { readBudget, stripBudget, withBudget } from '@/delight/budget';
import { MockupPreview } from '@/delight/MockupPreview';
import { isPreviewable } from '@/delight/checks';
import { celebrate } from '@/delight/effects';
import {
  createProject,
  updateProject,
  submitProject,
  uploadProjectArtwork,
  validateArtworkFile,
  UNSURE,
  type ProjectRow,
} from '@/lib/api/projects';
import { validateProjectForSubmit } from '@/lib/validation';
import {
  CANONICAL_UNIT,
  DIMENSION_PLACEHOLDERS,
  columnFromInches,
  columnToInches,
  composeDimensions,
  describeInUnit,
  parseDimensions,
  sanitizeDimensionInput,
} from '@/lib/dimensions';

type ProjectBuilderProps = {
  open: boolean;
  onClose: () => void;
  initialCategoryId?: string | null;
  /**
   * Called when someone with no artwork asks for a designer instead. The
   * customer frame passes this to swap straight into the design request form;
   * elsewhere the builder falls back to navigating there.
   */
  onWantDesigner?: () => void;
  /**
   * "Print again": an earlier project to copy. The builder skips the questions, opens on the details
   * step and fills everything in from it. Artwork is not copied — files belong to the project they
   * were uploaded to — so the form asks for it again.
   */
  template?: ProjectRow | null;
};

type Step = 'category' | 'recommend' | 'packaging' | 'quantity' | 'timeline' | 'details' | 'done';

const STEP_ORDER: Step[] = ['category', 'recommend', 'packaging', 'quantity', 'timeline', 'details', 'done'];

export function ProjectBuilder({ open, onClose, initialCategoryId, onWantDesigner, template }: ProjectBuilderProps) {
  const { session, profile, openSignIn } = useAuth();
  const navigate = useNavigate();
  const skin = useFlowSkin();

  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<CatalogCategory | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [packaging, setPackaging] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<string | null>(null);

  const [draft, setDraft] = useState<ProjectRow | null>(null);
  const [description, setDescription] = useState('');
  const [exactQuantity, setExactQuantity] = useState('');
  const [sizeSpec, setSizeSpec] = useState('');
  const [finishingPref, setFinishingPref] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [notes, setNotes] = useState('');
  // Shown as its own field, stored as a labelled line at the end of the notes (see delight/budget.ts).
  const [budget, setBudget] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [creatingDraft, setCreatingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards the draft-creation effect below against React 18 StrictMode's
  // dev-only double-invoke: a `creatingDraft` *state* read is still stale on
  // the second synchronous invocation (its setState hasn't flushed yet), so
  // both calls would pass the guard and insert two draft projects. A ref
  // mutates immediately and is shared across both invocations.
  const draftCreationStarted = useRef(false);

  useEffect(() => {
    if (open && template) {
      const cat = CATEGORIES.find((c) => c.id === template.category) ?? null;
      if (cat) {
        setCategory(cat);
        setStep('details');
        return;
      }
    }
    if (open && initialCategoryId) {
      const cat = CATEGORIES.find((c) => c.id === initialCategoryId) ?? null;
      if (cat) {
        setCategory(cat);
        setStep(cat.isSpecial ? 'details' : 'recommend');
        return;
      }
    }
    if (open && !initialCategoryId) {
      reset();
    }
    if (open && profile) {
      setDeliveryCity((c) => c || profile.city || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCategoryId, template]);

  const reset = () => {
    setStep('category');
    setCategory(null);
    setItem(null);
    setPackaging(null);
    setQuantity(null);
    setTimeline(null);
    setDraft(null);
    setDescription('');
    setExactQuantity('');
    setSizeSpec('');
    setFinishingPref('');
    setTargetDate('');
    setDeliveryCity(profile?.city ?? '');
    setNotes('');
    setBudget('');
    setFile(null);
    setFileError(null);
    setError(null);
    draftCreationStarted.current = false;
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const handleInitial = (id: string) => {
    const cat = CATEGORIES.find((c) => c.id === id) ?? null;
    if (cat) selectCategory(cat);
    else setStep('category');
  };

  const selectCategory = (cat: CatalogCategory) => {
    setCategory(cat);
    setError(null);
    setStep(cat.isSpecial ? 'details' : 'recommend');
  };

  const selectItem = (itemId: string) => {
    setItem(itemId);
    setError(null);
    setStep('packaging');
  };

  const selectPackaging = (id: string) => {
    setPackaging(id);
    setError(null);
    setStep('quantity');
  };

  const selectQuantity = (id: string) => {
    setQuantity(id);
    setError(null);
    setStep('timeline');
  };

  const selectTimeline = (id: string) => {
    setTimeline(id);
    setError(null);
    setStep('details');
  };

  const stepIndex = STEP_ORDER.indexOf(step);
  const canGoBack = step !== 'category' && step !== 'done';
  const goBack = () => {
    setError(null);
    if (step === 'recommend') setStep('category');
    else if (step === 'packaging') setStep('recommend');
    else if (step === 'quantity') setStep('packaging');
    else if (step === 'timeline') setStep('quantity');
    else if (step === 'details') {
      if (category?.isSpecial) setStep('category');
      else setStep('timeline');
    }
  };

  // Once we reach Details signed in, create the draft row right away so
  // artwork has somewhere to attach and "save & continue later" always works.
  useEffect(() => {
    if (step !== 'details' || !session || !profile || draft || creatingDraft || !category) return;
    if (draftCreationStarted.current) return;
    draftCreationStarted.current = true;
    setCreatingDraft(true);
    const itemObj = category.recommendations.find((i) => i.id === item);
    const pkgObj = PACKAGING_TYPES.find((p) => p.id === packaging);
    const qtyObj = QUANTITY_OPTIONS.find((q) => q.value === quantity);
    const tlObj = TIMELINE_OPTIONS.find((t) => t.value === timeline);

    const title = template?.title ?? itemObj?.name ?? category.name;
    const seedNotes = template ? (template.notes ?? '') : tlObj ? `Timeline preference: ${tlObj.label} (${tlObj.hint}).` : '';
    const seedDescription =
      template?.description ??
      [itemObj?.description, pkgObj ? `Preferred material: ${pkgObj.name}.` : null].filter(Boolean).join(' ');

    createProject({
      customerId: profile.id,
      title,
      category: category.id,
      description: seedDescription,
      quantityNote: template?.quantity_note ?? qtyObj?.label ?? null,
      materialPref: template?.material_pref ?? pkgObj?.name ?? (category.specialFlow ? null : null),
      deliveryCity: template?.delivery_city ?? profile.city ?? '',
      notes: seedNotes,
    })
      .then((p) => {
        setDraft(p);
        setDescription(p.description ?? '');
        setNotes(stripBudget(p.notes));
        setBudget(readBudget(p.notes));
        setDeliveryCity(p.delivery_city ?? profile.city ?? '');
        if (template) {
          setExactQuantity(template.quantity ? String(template.quantity) : '');
          setSizeSpec(template.size_spec ?? '');
          setFinishingPref(template.finishing_pref ?? '');
        }
      })
      .catch(() => setError('Could not start your project. Please try again.'))
      .finally(() => setCreatingDraft(false));
  }, [step, session, profile, draft, creatingDraft, category, item, packaging, quantity, timeline, template]);

  async function persistFields(): Promise<ProjectRow | null> {
    if (!draft) return null;
    const updated = await updateProject(draft.id, {
      description,
      quantity: exactQuantity ? Number(exactQuantity) : null,
      size_spec: sizeSpec || null,
      finishing_pref: finishingPref || null,
      target_date: targetDate || null,
      delivery_city: deliveryCity,
      notes: withBudget(notes, budget),
    });
    setDraft(updated);
    return updated;
  }

  async function handleSaveDraft() {
    setError(null);
    if (!draft) return;
    setSavingDraft(true);
    try {
      if (file) await handleUpload(draft.id);
      await persistFields();
      handleClose();
      navigate('/dashboard');
    } catch {
      setError('Could not save your project. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleUpload(projectId: string) {
    if (!file || !profile) return;
    await uploadProjectArtwork(projectId, profile.id, file);
  }

  async function handleSubmit() {
    if (!draft) return;
    setError(null);

    const errors = validateProjectForSubmit({
      title: draft.title,
      category: draft.category,
      description,
      deliveryCity,
    });
    if (errors.length) {
      setError(errors[0]);
      return;
    }

    setSubmitting(true);
    try {
      if (file) await handleUpload(draft.id);
      await persistFields();
      await submitProject(draft.id);
      setStep('done');
      celebrate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while sending your project. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(f: File | null) {
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const invalid = validateArtworkFile(f);
    if (invalid) {
      setFileError(invalid);
      return;
    }
    setFile(f);
  }

  const isSample = category?.specialFlow === 'sample';
  const isExpert = category?.specialFlow === 'expert';

  const showActions = step === 'details' && Boolean(session) && Boolean(draft) && !creatingDraft;

  function handleWantDesigner() {
    handleClose();
    if (onWantDesigner) onWantDesigner();
    else navigate('/dashboard/designs?new=1');
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      size="lg"
      full
      labelledBy="pb-title"
      skin={skin}
      footer={
        showActions ? (
          <div>
            <div className="flex gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSaveDraft}
                disabled={submitting}
                loading={savingDraft}
                icon={<Save className="h-5 w-5" />}
                className="shrink-0 max-sm:w-14 max-sm:px-0"
                aria-label="Save and continue later"
              >
                <span className="hidden sm:inline">Save &amp; continue later</span>
              </Button>
              <Button
                variant="accent"
                size="lg"
                fullWidth
                onClick={handleSubmit}
                loading={submitting}
                disabled={savingDraft || !description.trim() || !deliveryCity.trim()}
                icon={<Send className="h-5 w-5 max-sm:hidden" />}
                className="min-w-0 max-sm:px-4"
              >
                Send to printing partners
              </Button>
            </div>
            <p className="mt-2 text-center text-xs font-medium text-ink-500">No commitment · Matching partners respond with quotations</p>
          </div>
        ) : undefined
      }
    >
      <div className="px-5 pb-8 pt-4 sm:px-8 sm:pt-6">
        {step !== 'done' && (
          <div data-sheet-footer className="sticky top-0 z-10 -mx-5 bg-white/95 px-5 pb-4 pt-1 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex h-11 items-center gap-3 pr-12">
              {canGoBack ? (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Back"
                  className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 active:scale-95"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <RegistrationMark className="h-6 w-6 text-ink-300" />
              )}
              <p id="pb-title" className="slug text-ink-500">
                Project builder
              </p>
            </div>
            {!category?.isSpecial && (
              <div className="mt-1 flex gap-1.5" aria-hidden="true">
                {STEP_ORDER.slice(0, 6).map((s, i) => (
                  <span
                    key={s}
                    {...(i <= stepIndex ? { 'data-progress-done': '' } : { 'data-progress-todo': '' })}
                    className={`h-2 flex-1 rounded-full transition-colors duration-500 ${i <= stepIndex ? PROGRESS_INKS[i] : 'bg-ink-100'}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-3">
          {step === 'category' && <CategoryStep onPick={handleInitial} />}

          {step === 'recommend' && category && <RecommendStep category={category} onPick={selectItem} selected={item} />}

          {step === 'packaging' && category && item && (
            <PackagingStep category={category} itemId={item} onPick={selectPackaging} selected={packaging} />
          )}

          {step === 'quantity' && (
            <ChoiceStep
              title="How many do you need?"
              subtitle="Pick the range that fits. We'll refine exact quantities later."
              options={QUANTITY_OPTIONS}
              onPick={selectQuantity}
              selected={quantity}
            />
          )}

          {step === 'timeline' && (
            <ChoiceStep
              title="When do you need it?"
              subtitle="Your timeline affects production scheduling and pricing."
              options={TIMELINE_OPTIONS}
              onPick={selectTimeline}
              selected={timeline}
            />
          )}

          {step === 'details' &&
            (!session ? (
              <SignInPrompt onSignIn={() => openSignIn({ stayPut: true })} />
            ) : creatingDraft || !draft ? (
              <div className="flex flex-col items-center gap-4 py-24 text-ink-500">
                <InkLoader className="[&>span]:h-3.5 [&>span]:w-3.5" />
                <p className="text-sm font-medium">Setting up your project…</p>
              </div>
            ) : (
              <DetailsStep
                isSample={isSample}
                isExpert={isExpert}
                itemId={item}
                description={description}
                setDescription={setDescription}
                exactQuantity={exactQuantity}
                setExactQuantity={setExactQuantity}
                sizeSpec={sizeSpec}
                setSizeSpec={setSizeSpec}
                finishingPref={finishingPref}
                setFinishingPref={setFinishingPref}
                targetDate={targetDate}
                setTargetDate={setTargetDate}
                deliveryCity={deliveryCity}
                setDeliveryCity={setDeliveryCity}
                notes={notes}
                setNotes={setNotes}
                budget={budget}
                setBudget={setBudget}
                reorderOf={template?.title ?? null}
                file={file}
                fileError={fileError}
                onFileChange={handleFileChange}
                onWantDesigner={handleWantDesigner}
                error={error}
              />
            ))}

          {step === 'done' && <DoneStep category={category} onRestart={reset} onClose={handleClose} />}
        </div>
      </div>
    </Sheet>
  );
}

/** The six steps fill in press order: cyan, magenta, yellow, key — then the two overprints. */
const PROGRESS_INKS = ['bg-cyan-400', 'bg-magenta-500', 'bg-sun-400', 'bg-ink-950', 'bg-grape-500', 'bg-leaf-500'];

const TILE_TINTS = ['bg-cyan-200', 'bg-magenta-200', 'bg-sun-200', 'bg-grape-200', 'bg-leaf-200'];

function StepHeading({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-balance text-3xl text-ink-950 sm:text-4xl">{title}</h3>
      {subtitle && <p className="mt-2 text-ink-600">{subtitle}</p>}
    </div>
  );
}

/** One tappable answer. Shared by every multiple-choice step. */
function OptionCard({
  active,
  onClick,
  lead,
  title,
  body,
  foot,
}: {
  active: boolean;
  onClick: () => void;
  lead?: React.ReactNode;
  title: string;
  body?: string;
  foot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-option
      className={`group flex w-full items-center gap-4 rounded-3xl p-4 text-left transition-all duration-200 active:scale-[0.985] ${
        active ? 'bg-ink-950 text-white shadow-card' : 'bg-white ring-2 ring-inset ring-ink-100 hover:ring-ink-900'
      }`}
    >
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold leading-tight">{title}</span>
        {body && <span data-option-sub className={`mt-1 block text-sm leading-snug ${active ? 'text-white/70' : 'text-ink-600'}`}>{body}</span>}
        {foot && <span data-option-sub className={`mt-1.5 block text-xs leading-snug ${active ? 'text-white/50' : 'text-ink-400'}`}>{foot}</span>}
      </span>
      <span
        data-option-tick
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
          active ? 'bg-sun-400 text-ink-950' : 'bg-ink-100 text-transparent group-hover:text-ink-400'
        }`}
      >
        {active ? <Check className="h-4 w-4" strokeWidth={3} /> : <ArrowRight className="h-4 w-4" />}
      </span>
    </button>
  );
}

function CategoryStep({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="animate-fade-up">
      <StepHeading title="What are you making?" subtitle="Choose the closest match — we'll guide the rest." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onPick(cat.id)}
            data-option
            className={`group relative flex min-h-[9.5rem] flex-col overflow-hidden rounded-3xl p-4 text-left transition-transform duration-200 hover:-translate-y-1 active:scale-[0.97] ${
              cat.isSpecial ? 'bg-ink-950 text-white' : `${TILE_TINTS[i % TILE_TINTS.length]} text-ink-950`
            }`}
          >
            <span
              className={`pointer-events-none absolute -right-5 -top-5 h-24 w-24 bg-halftone bg-dots ${cat.isSpecial ? 'text-white/15' : 'text-ink-950/10'}`}
              aria-hidden="true"
            />
            <span className="flex items-center justify-between">
              <span data-option-icon className={`flex h-11 w-11 items-center justify-center rounded-2xl ${cat.isSpecial ? 'bg-white/10' : 'bg-white'}`}>
                <cat.icon className="h-6 w-6" strokeWidth={1.9} />
              </span>
              {cat.isSpecial && (
                <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-ink-950">Pro</span>
              )}
            </span>
            <span className="mt-auto pt-4 font-display text-[1.05rem] font-bold leading-tight">{cat.name}</span>
            <span data-option-sub className={`mt-1 line-clamp-2 text-xs leading-snug ${cat.isSpecial ? 'text-white/60' : 'text-ink-700'}`}>{cat.tagline}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecommendStep({
  category,
  onPick,
  selected,
}: {
  category: CatalogCategory;
  onPick: (id: string) => void;
  selected: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <p className="slug mb-2 text-magenta-600">
        <Sparkles className="h-3.5 w-3.5" /> PrintAir recommends
      </p>
      <StepHeading
        title="Which would you like to begin with?"
        subtitle={
          <>
            For <b className="text-ink-900">{category.name}</b>, these are a great place to start.
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {category.recommendations.map((rec, i) => {
          const active = selected === rec.id;
          return (
            <OptionCard
              key={rec.id}
              active={active}
              onClick={() => onPick(rec.id)}
              title={rec.name}
              body={rec.description}
              lead={
                <span
                  data-option-icon
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-ink-950 ${
                    active ? 'bg-white' : TILE_TINTS[i % TILE_TINTS.length]
                  }`}
                >
                  <rec.icon className="h-7 w-7" strokeWidth={1.8} />
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/** A rough impression of each stock, so the choice isn't made from words alone. */
const STOCK_SWATCH: Record<string, React.CSSProperties> = {
  kraft: { background: 'repeating-linear-gradient(115deg, #c79a62 0 3px, #bf9058 3px 6px)' },
  'art-card': { background: 'linear-gradient(135deg, #ffffff 0%, #eef1f8 45%, #ffffff 60%, #e3e7f2 100%)' },
  corrugated: { background: 'repeating-linear-gradient(90deg, #d4ad78 0 5px, #b98d55 5px 8px)' },
  'sticker-paper': { background: 'radial-gradient(circle at 78% 22%, #ffffff 0 22%, #f1eee6 23% 100%)' },
  'sticker-vinyl': { background: 'linear-gradient(135deg, #2aa5e3 0%, #7352f2 55%, #e6017f 100%)' },
  textured: { background: 'repeating-linear-gradient(0deg, #f4efe4 0 2px, #e8e0cf 2px 3px), #f4efe4' },
};

function PackagingStep({
  category,
  itemId,
  onPick,
  selected,
}: {
  category: CatalogCategory;
  itemId: string;
  onPick: (id: string) => void;
  selected: string | null;
}) {
  const itemObj = category.recommendations.find((i) => i.id === itemId);
  const allowedIds = itemObj?.packagingOptions ?? PACKAGING_TYPES.map((p) => p.id);
  const options = PACKAGING_TYPES.filter((p) => allowedIds.includes(p.id));

  return (
    <div className="animate-fade-up">
      <StepHeading
        title="What feel are you going for?"
        subtitle={
          <>
            Great choice. For <b className="text-ink-900">{itemObj?.name}</b>, pick the stock that sounds closest — we can refine it
            later.
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((pkg) => (
          <OptionCard
            key={pkg.id}
            active={selected === pkg.id}
            onClick={() => onPick(pkg.id)}
            title={pkg.name}
            body={pkg.description}
            foot={pkg.blurb}
            lead={<span className="h-16 w-14 shrink-0 self-start rounded-2xl shadow-soft ring-1 ring-ink-900/10" style={STOCK_SWATCH[pkg.id]} aria-hidden="true" />}
          />
        ))}
      </div>
    </div>
  );
}

function ChoiceStep({
  title,
  subtitle,
  options,
  onPick,
  selected,
}: {
  title: string;
  subtitle: string;
  options: { value: string; label: string; hint: string }[];
  onPick: (id: string) => void;
  selected: string | null;
}) {
  return (
    <div className="animate-fade-up">
      <StepHeading title={title} subtitle={subtitle} />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => (
          <OptionCard key={opt.value} active={selected === opt.value} onClick={() => onPick(opt.value)} title={opt.label} body={opt.hint} />
        ))}
      </div>
    </div>
  );
}

function SignInPrompt({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="animate-fade-up py-10 text-center">
      <span className="mx-auto flex h-20 w-20 -rotate-6 items-center justify-center rounded-4xl bg-sun-300 text-ink-950">
        <Sparkles className="h-9 w-9" />
      </span>
      <h3 className="mt-6 text-3xl text-ink-950">Almost there</h3>
      <p className="mx-auto mt-3 max-w-sm text-ink-600">
        Create your free PrintAir account (takes a few seconds) so we can save your project and send it to matching printing
        partners.
      </p>
      <Button variant="accent" size="lg" className="mt-7" onClick={onSignIn} iconRight={<ArrowRight className="h-5 w-5" />}>
        Log in or sign up
      </Button>
      <p className="mt-4 text-sm font-medium text-ink-500">Your answers stay right here.</p>
    </div>
  );
}

function DetailsStep({
  isSample,
  isExpert,
  itemId,
  description,
  setDescription,
  exactQuantity,
  setExactQuantity,
  sizeSpec,
  setSizeSpec,
  finishingPref,
  setFinishingPref,
  targetDate,
  setTargetDate,
  deliveryCity,
  setDeliveryCity,
  notes,
  setNotes,
  budget,
  setBudget,
  reorderOf,
  file,
  fileError,
  onFileChange,
  onWantDesigner,
  error,
}: {
  isSample: boolean;
  isExpert: boolean;
  itemId: string | null;
  description: string;
  setDescription: (v: string) => void;
  exactQuantity: string;
  setExactQuantity: (v: string) => void;
  sizeSpec: string;
  setSizeSpec: (v: string) => void;
  finishingPref: string;
  setFinishingPref: (v: string) => void;
  targetDate: string;
  setTargetDate: (v: string) => void;
  deliveryCity: string;
  setDeliveryCity: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  budget: string;
  setBudget: (v: string) => void;
  reorderOf: string | null;
  file: File | null;
  fileError: string | null;
  onFileChange: (f: File | null) => void;
  onWantDesigner: () => void;
  error: string | null;
}) {
  const heading = isSample ? 'Show us your sample' : isExpert ? 'Tell us your specifications' : 'A few more details';
  const sub = isSample
    ? 'Describe what you have and any improvements you want.'
    : isExpert
      ? 'Share the details you already know — we will route it to the right partners.'
      : 'This is what printing partners will see when they review your project.';

  return (
    <div className="animate-fade-up">
      <StepHeading title={heading} subtitle={sub} />

      {reorderOf && (
        <Banner tone="success" className="mb-5">
          Printing &ldquo;{reorderOf}&rdquo; again. Everything is filled in from last time: change what you need, add your artwork, and
          send. Printing partners will quote it fresh.
        </Banner>
      )}

      {(isSample || isExpert) && (
        <Banner tone="info" className="mb-5">
          {isSample
            ? 'Attach a photo of your sample below and describe what you want changed.'
            : 'Include size, material, quantity, and finish in the description for the fastest response.'}
        </Banner>
      )}

      <div className="space-y-5">
        <TextAreaField
          label="Describe what you need"
          required
          value={description}
          onChange={setDescription}
          placeholder="e.g. 8x8 inch windowed cake boxes with our logo printed in one colour."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Exact quantity (optional)" type="number" inputMode="numeric" value={exactQuantity} onChange={setExactQuantity} placeholder="e.g. 500" />
          <TextField label="Target date (optional)" type="date" value={targetDate} onChange={setTargetDate} />
        </div>

        <DimensionsField shape={dimensionShapeFor(itemId)} value={sizeSpec} onChange={setSizeSpec} />
        {/* A single-line box with a one-item example read as "pick one", so windows,
            embossing and foil ended up in Notes where a partner may not look for
            them. This is the place for everything done to the print after printing. */}
        <UnsureField
          label="Finishing and extras"
          value={finishingPref}
          onChange={setFinishingPref}
          rows={2}
          placeholder="e.g. matte lamination, window, embossing, gold foil stamping"
          hint="Anything done after printing. List as many as you need."
        />

        <TextField label="Delivery city" value={deliveryCity} onChange={setDeliveryCity} placeholder="e.g. Pasig City" required />

        <TextField
          label="Your budget (optional)"
          type="number"
          inputMode="numeric"
          value={budget}
          onChange={setBudget}
          placeholder="e.g. 5000"
          hint="In pesos. Printing partners see it and quote what fits, or suggest the closest option."
        />

        <TextAreaField
          label={`Notes ${isSample || isExpert ? '(helpful)' : '(optional)'}`}
          rows={2}
          value={notes}
          onChange={setNotes}
          placeholder="Anything else — delivery instructions, a past order to match, who to contact."
        />

        <Field label="Artwork or reference file (optional)" error={fileError}>
          {file ? (
            <div className="space-y-3">
              <FileRow name={file.name} size={file.size} onRemove={() => onFileChange(null)} />
              {isPreviewable(file) && <MockupPreview file={file} />}
            </div>
          ) : (
            <Dropzone
              accept=".pdf,.jpg,.jpeg,.png,.ai,.zip"
              onFiles={(list) => onFileChange(list?.[0] ?? null)}
              title="Add your artwork"
              hint="PDF, JPG, PNG, AI or ZIP · up to 25MB"
            />
          )}
        </Field>

        {/*
          The route into the designer marketplace: a customer with no artwork is
          offered a designer here, at the exact moment they discover they need
          one. Only shown when no file is attached, so it never nags someone who
          already has artwork.
        */}
        {!file && (
          <button
            type="button"
            onClick={onWantDesigner}
            className="group flex w-full items-center gap-4 rounded-3xl bg-magenta-50 p-4 text-left ring-1 ring-magenta-200/70 transition-colors hover:bg-magenta-100"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-magenta-200 text-ink-950">
              <Palette className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink-950">Don&apos;t have artwork yet?</span>
              <span className="block text-sm text-ink-600">
                Commission a vetted designer — the finished file flows straight into a print project.
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-magenta-600 transition-transform group-hover:translate-x-1" />
          </button>
        )}

        <FormError>{error}</FormError>
      </div>
    </div>
  );
}

function DoneStep({ category, onRestart, onClose }: { category: CatalogCategory | null; onRestart: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const confetti = ['bg-cyan-400', 'bg-magenta-500', 'bg-sun-400', 'bg-grape-500', 'bg-leaf-400', 'bg-ink-950'];
  return (
    <div className="relative animate-fade-up overflow-hidden px-1 py-10 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-5" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 animate-confetti rounded-[3px] ${confetti[i % confetti.length]}`}
            style={{ animationDelay: `${(i % 7) * 0.09}s`, marginTop: `${(i * 13) % 28}px` }}
          />
        ))}
      </div>
      <span className="relative mx-auto flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-leaf-300" aria-hidden="true" />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-leaf-400 text-ink-950">
          <Check className="h-11 w-11" strokeWidth={3} />
        </span>
      </span>
      <h3 className="mt-7 text-4xl text-ink-950">Your project is on its way!</h3>
      <p className="mx-auto mt-3 max-w-md text-ink-600">
        We&apos;re matching your <b className="text-ink-900">{category?.name.toLowerCase()}</b> project to verified printing partners.
        You&apos;ll see quotations appear in your dashboard as they come in.
      </p>
      <ul className="mx-auto mt-7 max-w-sm space-y-3 rounded-3xl bg-ink-50 p-5 text-left">
        {[
          'Matched to verified Philippine manufacturing partners',
          'Compare quotations side by side — no automatic winner',
          'Track production from confirmed to delivered',
        ].map((t) => (
          <li key={t} className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-leaf-600" />
            <span className="font-medium text-ink-800">{t}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
        <Button variant="secondary" size="lg" onClick={onRestart} icon={<RotateCcw className="h-5 w-5" />}>
          Start another project
        </Button>
        <Button
          size="lg"
          onClick={() => {
            onClose();
            navigate('/dashboard');
          }}
          iconRight={<ArrowRight className="h-5 w-5" />}
        >
          View my projects
        </Button>
      </div>
    </div>
  );
}

function UnsureToggle({ unsure, onToggle }: { unsure: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={unsure}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ${
        unsure ? 'bg-sun-300 text-ink-950' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
      }`}
    >
      {unsure ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Lightbulb className="h-3.5 w-3.5" />}
      {unsure ? 'Not sure' : "I'm not sure"}
    </button>
  );
}

function RecommendNote() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-sun-100 px-4 py-3 font-medium text-sun-900">
      <Lightbulb className="h-5 w-5 shrink-0" /> We will recommend this for you
    </div>
  );
}

/** A free-text field with a one-tap "I'm not sure" fallback, so nobody is blocked by a technical question. */
function UnsureField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  /** Given, the field is a textarea of this many rows: for answers that are a list, not a word. */
  rows?: number;
}) {
  const unsure = value === UNSURE;
  return (
    <Field label={label} hint={hint} action={<UnsureToggle unsure={unsure} onToggle={() => onChange(unsure ? '' : UNSURE)} />}>
      {unsure ? (
        <RecommendNote />
      ) : rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="control resize-y" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="control" />
      )}
    </Field>
  );
}

/**
 * Size input that adapts to what is actually being printed.
 *
 * A box needs three labelled axes, a bag needs a gusset, and a sticker needs
 * two — one free-text box for all of them produced entries like "5x", which a
 * partner cannot quote against. Bespoke items (shape === null) keep the
 * free-text field, since forcing them into axes would misdescribe them.
 *
 * The stored value is always inches in L×W×H order (see lib/dimensions). The
 * unit selector chooses only how the customer *types*: someone who measured
 * with a metric tape enters centimetres and it is converted at the door. That
 * removes the worst error in the flow — entering metric numbers under an inch
 * label — without pushing the conversion onto the person least equipped to do
 * it. The echo underneath shows the other unit so a wrong one is visible on
 * screen rather than discovered at sampling.
 */
function DimensionsField({
  shape,
  value,
  onChange,
}: {
  shape: DimensionShape | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const [entryUnit, setEntryUnit] = useState<DimensionUnit>(CANONICAL_UNIT);
  // What is being typed in each box, kept apart from the stored value.
  //
  // The boxes used to show the stored value straight back, and that value is
  // always a parsed number: type "4." and it is stored as 4, so the box
  // re-rendered as "4" and the "5" that followed made "45". A decimal could
  // never be typed. The draft holds the raw keystrokes while a box is being
  // edited; the stored value still updates on every keystroke, and the draft
  // is let go once the box loses focus or the unit switches.
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  if (!shape) {
    return <UnsureField label="Size or dimensions" value={value} onChange={onChange} placeholder="e.g. 8 x 8 x 5 in" />;
  }

  const axes = DIMENSION_AXES[shape];
  const unsure = value === UNSURE;
  const parsed = parseDimensions(value, axes.length);
  // A legacy or hand-typed value we cannot parse is preserved rather than
  // silently discarded — the customer keeps editing it as free text.
  const freeform = !unsure && value !== '' && parsed === null;
  const inches = parsed?.inches ?? axes.map(() => '');
  const shown = columnFromInches(inches, entryUnit);
  const echoUnit: DimensionUnit = entryUnit === 'in' ? 'cm' : 'in';
  const echo = describeInUnit(inches, echoUnit);

  const update = (index: number, next: string) => {
    const typed = sanitizeDimensionInput(next);
    setDrafts((d) => ({ ...d, [index]: typed }));
    const nextShown = [...shown];
    nextShown[index] = typed;
    onChange(composeDimensions(columnToInches(nextShown, entryUnit), axes));
  };
  const settle = (index: number) =>
    setDrafts((d) => {
      const rest = { ...d };
      delete rest[index];
      return rest;
    });

  return (
    <Field label="Size or dimensions" action={<UnsureToggle unsure={unsure} onToggle={() => onChange(unsure ? '' : UNSURE)} />}>
      {unsure ? (
        <RecommendNote />
      ) : freeform ? (
        <div className="space-y-2">
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Size or dimensions" className="control" />
          <button type="button" onClick={() => onChange('')} className="text-sm font-bold text-magenta-700 hover:underline">
            Enter as {axes.join(' × ')} instead
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            {axes.map((axis, i) => (
              <div key={axis} className="min-w-0 flex-1">
                <span className="mb-1 block text-center text-[0.68rem] font-extrabold uppercase tracking-wider text-ink-400">{axis}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={drafts[i] ?? shown[i] ?? ''}
                  onChange={(e) => update(i, e.target.value)}
                  onBlur={() => settle(i)}
                  placeholder={DIMENSION_PLACEHOLDERS[shape][i]}
                  aria-label={`${axis} in ${entryUnit}`}
                  className="control px-2 text-center font-display text-xl font-bold placeholder:font-sans placeholder:text-base placeholder:font-normal"
                />
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-ink-100 p-1" role="group" aria-label="Unit you are measuring in">
              {DIMENSION_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    setDrafts({});
                    setEntryUnit(u);
                  }}
                  aria-pressed={entryUnit === u}
                  className={`min-h-8 rounded-full px-4 text-sm font-bold transition-all ${
                    entryUnit === u ? 'bg-white text-ink-950 shadow-soft' : 'text-ink-500'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            {echo && (
              <p className="text-xs font-medium text-ink-500">
                ≈ {echo} · partners receive this as {axes.map((a) => a[0]).join('×')} in inches
              </p>
            )}
          </div>
        </>
      )}
    </Field>
  );
}
