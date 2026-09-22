import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextField, TextAreaField, Field } from '@/components/ui/Field';
import { Dropzone } from '@/components/ui/Dropzone';
import { FileRow } from '@/components/ui/bits';
import { FormError } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { DESIGN_NEEDS } from '@/data/catalog';
import { useFlowSkin } from '@/lib/look';
import { withNeeds, primarySpecialtyFor, describeNeeds, titleForNeeds } from '@/delight/designNeeds';
import { validateDesignRequestForSubmit } from '@/lib/validation';
import {
  createDesignRequest,
  submitDesignRequest,
  deleteDraftDesignRequest,
  uploadDesignRequestFile,
  validateBriefFile,
} from '@/lib/api/designRequests';

/**
 * "Commission a designer" — the customer-facing entry point into design
 * requests. Deliberately a single panel, not a multi-step wizard like
 * ProjectBuilder: a design brief has far fewer fields (no dimensions, no
 * packaging material) than a print project, so a wizard would just be extra
 * clicks over one honest form.
 *
 * On submit: creates the DRAFT row, uploads any staged reference files, then
 * calls submit_design_request() — never sets status directly on the INSERT
 * (see designRequests.ts's header comment on why that would skip the
 * opportunity fan-out trigger).
 */
export function DesignRequestBuilder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  // Everything the customer needs, in their words. The one specialty column
  // gets whichever discipline covers most of the list; the full list rides in
  // the notes (see delight/designNeeds.ts).
  const [needs, setNeeds] = useState<string[]>([]);
  const [otherNeed, setOtherNeed] = useState('');
  const specialty = primarySpecialtyFor(needs);
  // No title field: the request is named after its needs ("Logo, Labels & Box").
  const title = titleForNeeds(needs, otherNeed);
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setNeeds([]);
    setOtherNeed('');
    setDescription('');
    setBudgetMin('');
    setBudgetMax('');
    setTargetDate('');
    setNotes('');
    setFiles([]);
    setError(null);
  }

  function handleClose() {
    if (!busy) reset();
    onClose();
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    // Copied out now: the picker is cleared right after this returns, which empties the FileList,
    // and React may not run the state updater below until later.
    const picked = Array.from(list);
    for (const file of picked) {
      const problem = validateBriefFile(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        return;
      }
    }
    setFiles((prev) => [...prev, ...picked]);
  }

  async function handleSubmit() {
    if (!profile) return;
    setError(null);
    // The shared validator still asks for a "specialty"; the form asks for
    // needs. Same check, said the way this screen says it.
    if (needs.length === 0) {
      setError('Choose at least one design need.');
      return;
    }
    if (needs.includes('other') && !otherNeed.trim()) {
      setError('Tell us what else you need designed, or unselect "Something else".');
      return;
    }
    // The backend insists on a description (submit_design_request raises
    // without one), but the customer no longer has to write it: left blank, the
    // list of needs they picked stands in. It is the one thing we know for
    // certain about the job, and a designer can work from it.
    const briefDescription = description.trim() || describeNeeds(needs, otherNeed);
    const errors = validateDesignRequestForSubmit({ title, specialty, description: briefDescription });
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    if (budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
      setError('Your maximum budget cannot be lower than your minimum.');
      return;
    }

    setBusy(true);
    let requestId: string | null = null;
    try {
      const request = await createDesignRequest({
        customerId: profile.id,
        title: title.trim(),
        specialty,
        description: briefDescription,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        targetDate: targetDate || null,
        notes: withNeeds(notes.trim(), needs, otherNeed) || null,
      });
      requestId = request.id;

      for (const file of files) {
        await uploadDesignRequestFile(request.id, profile.id, file);
      }

      await submitDesignRequest(request.id);
      reset();
      onClose();
    } catch (e) {
      // A draft row may already exist at this point (created, but the
      // submission itself failed) — remove it rather than leaving an orphan
      // the customer never sees, since this form has no "resume draft" path.
      if (requestId) {
        await deleteDraftDesignRequest(requestId).catch(() => {});
      }
      setError(e instanceof Error ? e.message : 'Could not post your request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const tiles = ['bg-sun-200', 'bg-cyan-200', 'bg-magenta-200', 'bg-grape-200'];
  const toggleNeed = (id: string) => setNeeds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  // Commissioning a designer is a guided flow like building a print project,
  // so it wears the same Classic skin (docs/DESIGN-SYSTEM.md, "Skins").
  const skin = useFlowSkin();

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      labelledBy="design-request-builder-title"
      size="md"
      full
      skin={skin}
      footer={
        <Button fullWidth size="lg" variant="accent" onClick={handleSubmit} loading={busy} icon={<Send className="h-5 w-5" />}>
          Post to designers
        </Button>
      }
    >
      <div className="px-5 pb-6 pt-7 sm:px-8 sm:pt-9">
        <p className="slug text-magenta-600">Design request</p>
        <h2 id="design-request-builder-title" className="mt-2 pr-12 text-3xl text-ink-950">
          Commission a designer
        </h2>
        <p className="mt-2 text-ink-600">
          Tell us what you need designed. Vetted designers who do this kind of work will send proposals.
        </p>

        <div className="mt-7 space-y-5">
          <Field label="Design needs" required>
            <p className="-mt-1 mb-3 text-sm text-ink-600">Choose everything this job needs — one request, one designer for all of it.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {DESIGN_NEEDS.map((n, i) => {
                const active = needs.includes(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggleNeed(n.id)}
                    aria-pressed={active}
                    data-option
                    className={`relative rounded-3xl p-3.5 pr-10 text-left transition-all active:scale-[0.98] ${
                      active ? 'bg-ink-950 text-white' : `${tiles[i % tiles.length]} text-ink-950`
                    }`}
                  >
                    <span className="block font-display text-base font-bold leading-tight">{n.name}</span>
                    <span data-option-sub className={`mt-1 block text-xs leading-snug ${active ? 'text-white/70' : 'text-ink-700'}`}>{n.tagline}</span>
                    <span
                      data-option-tick
                      aria-hidden="true"
                      className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full ${active ? 'bg-white text-ink-950' : 'bg-white/60 text-transparent'}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
            {needs.includes('other') && (
              <div className="mt-3 animate-fade-up">
                <TextField
                  label="What else do you need designed?"
                  value={otherNeed}
                  onChange={setOtherNeed}
                  placeholder="e.g. Hand-lettered menu board, event backdrop"
                  autoFocus
                />
              </div>
            )}
          </Field>

          <TextAreaField
            label="Description (optional)"
            rows={4}
            value={description}
            onChange={setDescription}
            hint="Skip it and designers see the needs you picked above."
            placeholder="What is this for, and what should it feel like? Any brand colors or references you already have."
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField label="Budget from (₱)" type="number" inputMode="numeric" value={budgetMin} onChange={setBudgetMin} placeholder="3000" />
            <TextField label="Budget to (₱)" type="number" inputMode="numeric" value={budgetMax} onChange={setBudgetMax} placeholder="10000" />
          </div>

          <TextField label="Target date (optional)" type="date" value={targetDate} onChange={setTargetDate} />

          <Field label="Reference files (optional)">
            <Dropzone
              multiple
              tone="magenta"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.zip"
              onFiles={addFiles}
              title="Add reference images or a brand kit"
              hint="PDF, JPG, PNG, WebP or ZIP · up to 25MB each"
            />
            {files.length > 0 && (
              <div className="mt-2.5 space-y-2">
                {files.map((f, i) => (
                  <FileRow key={i} name={f.name} size={f.size} onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
                ))}
              </div>
            )}
          </Field>

          <TextAreaField label="Notes (optional)" rows={2} value={notes} onChange={setNotes} placeholder="Anything else a designer should know." />

          <FormError>{error}</FormError>
        </div>
      </div>
    </Sheet>
  );
}
