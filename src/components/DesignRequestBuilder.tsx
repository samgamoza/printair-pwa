import { useState } from 'react';
import { Send } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextField, TextAreaField, Field } from '@/components/ui/Field';
import { Dropzone } from '@/components/ui/Dropzone';
import { FileRow } from '@/components/ui/bits';
import { FormError } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { DESIGN_SPECIALTIES } from '@/data/catalog';
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
  const [title, setTitle] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [description, setDescription] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setTitle('');
    setSpecialty('');
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
    for (const file of Array.from(list)) {
      const problem = validateBriefFile(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        return;
      }
    }
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function handleSubmit() {
    if (!profile) return;
    setError(null);
    const errors = validateDesignRequestForSubmit({ title, specialty, description });
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
        description: description.trim(),
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        targetDate: targetDate || null,
        notes: notes.trim() || null,
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

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      labelledBy="design-request-builder-title"
      size="md"
      full
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
          Tell us what you need designed. Vetted designers matching your specialty will send proposals.
        </p>

        <div className="mt-7 space-y-5">
          <TextField label="Title" value={title} onChange={setTitle} placeholder="Logo for a new coffee shop" required />

          <Field label="Specialty" required>
            <div className="grid grid-cols-2 gap-2.5">
              {DESIGN_SPECIALTIES.map((s, i) => {
                const active = specialty === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpecialty(s.id)}
                    aria-pressed={active}
                    className={`rounded-3xl p-4 text-left transition-all active:scale-[0.98] ${
                      active ? 'bg-ink-950 text-white' : `${tiles[i % tiles.length]} text-ink-950`
                    }`}
                  >
                    <span className="block font-display text-lg font-bold leading-tight">{s.name}</span>
                    <span className={`mt-1 block text-sm ${active ? 'text-white/70' : 'text-ink-700'}`}>{s.tagline}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <TextAreaField
            label="Description"
            required
            rows={4}
            value={description}
            onChange={setDescription}
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
