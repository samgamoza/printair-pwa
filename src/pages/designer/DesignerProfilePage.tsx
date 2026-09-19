import { useEffect, useState } from 'react';
import { Check, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Dropzone } from '@/components/ui/Dropzone';
import { Chip, Field, TextField, TextAreaField } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/bits';
import { FormError, PageLoader } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMyPortfolio,
  getMySpecialties,
  setMySpecialties,
  updateMyDesignerProfile,
  uploadPortfolioItem,
  deletePortfolioItem,
  portfolioUrl,
  validatePortfolioFile,
  type DesignerPortfolioItemRow,
} from '@/lib/api/designer';
import { DESIGN_SPECIALTIES } from '@/data/catalog';

export default function DesignerProfilePage() {
  const { designerProfile, refreshProfile } = useAuth();

  const [portfolio, setPortfolio] = useState<DesignerPortfolioItemRow[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!designerProfile) return;
    setDisplayName(designerProfile.display_name);
    setCity(designerProfile.city);
    setBio(designerProfile.bio ?? '');
    setTurnaround(designerProfile.typical_turnaround_days?.toString() ?? '');
    setRateMin(designerProfile.rate_min?.toString() ?? '');
    setRateMax(designerProfile.rate_max?.toString() ?? '');
    Promise.all([getMyPortfolio(designerProfile.id), getMySpecialties(designerProfile.id)])
      .then(([items, specs]) => {
        setPortfolio(items);
        setSpecialties(specs);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, [designerProfile]);

  async function reloadPortfolio() {
    if (!designerProfile) return;
    setPortfolio(await getMyPortfolio(designerProfile.id));
  }

  async function handleSave() {
    if (!designerProfile) return;
    setError(null);
    if (!displayName.trim()) return setError('Enter the name customers will see.');
    if (!city.trim()) return setError('Enter your city.');
    if (specialties.length === 0) return setError('Choose at least one specialty.');

    const min = rateMin ? Number(rateMin) : null;
    const max = rateMax ? Number(rateMax) : null;
    if (min !== null && max !== null && max < min) {
      return setError('Your maximum rate cannot be lower than your minimum.');
    }

    setSaving(true);
    try {
      await updateMyDesignerProfile(designerProfile.id, {
        display_name: displayName.trim(),
        city: city.trim(),
        bio: bio.trim() || null,
        typical_turnaround_days: turnaround ? Number(turnaround) : null,
        rate_min: min,
        rate_max: max,
      });
      await setMySpecialties(designerProfile.id, specialties);
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !designerProfile) return;
    setError(null);
    // Validated before upload so the reason is specific, rather than letting
    // the bucket reject it with a generic storage error.
    for (const file of Array.from(files)) {
      const problem = validatePortfolioFile(file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        return;
      }
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadPortfolioItem(designerProfile.id, file);
      }
      await reloadPortfolio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload that file.');
    } finally {
      setUploading(false);
      // No input to reset here: the Dropzone clears its own, so the same file can be picked again.
    }
  }

  async function handleDelete(item: DesignerPortfolioItemRow) {
    setError(null);
    try {
      await deletePortfolioItem(item);
      await reloadPortfolio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that sample.');
    }
  }

  function toggleSpecialty(id: string) {
    setSpecialties((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  if (loading) return <PageLoader label="Loading your profile…" />;

  const pending = designerProfile?.status === 'pending_review';

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My Profile"
        subtitle={
          pending
            ? 'This is what a reviewer sees. Portfolio samples matter most.'
            : 'This is what customers see when your proposal arrives.'
        }
      />

      {error && (
        <div className="mb-5">
          <FormError>{error}</FormError>
        </div>
      )}

      {/* Portfolio first: it is the thing that decides the application. */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl text-ink-950">Portfolio</h2>
          {portfolio.length > 0 && (
            <span className="rounded-full bg-grape-100 px-3 py-1 text-sm font-extrabold text-grape-800">
              {portfolio.length} {portfolio.length === 1 ? 'sample' : 'samples'}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-ink-600">
          JPG, PNG, WebP, or PDF, up to 10MB each. Reviewers look for print-ready work — correct bleed, resolution, and format.
        </p>

        {portfolio.length === 0 ? (
          <div className="mt-4 rounded-3xl bg-grape-50 px-6 py-8 text-center font-medium text-grape-900 ring-1 ring-grape-200/70">
            No samples yet. Three or more gives a reviewer enough to judge.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {portfolio.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-900/5">
                {item.mime_type?.startsWith('image/') ? (
                  <img
                    src={portfolioUrl(item.storage_path)}
                    alt={item.file_name}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-grape-100 px-3 pb-8 text-center text-sm font-bold text-grape-900">
                    <FileText className="h-7 w-7 shrink-0 text-grape-600" />
                    <span className="line-clamp-2 break-all">{item.file_name}</span>
                  </div>
                )}
                {/* Caption strip laid over the bottom edge of the tile. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/80 to-transparent px-3.5 pb-2.5 pt-8">
                  {item.caption && <p className="truncate text-sm font-bold text-white">{item.caption}</p>}
                  <p className="truncate text-xs font-medium text-white/80">
                    {item.width_px && item.height_px ? `${item.width_px}×${item.height_px}` : item.mime_type ?? ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  aria-label={`Remove ${item.file_name}`}
                  className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-ink-700 shadow-soft transition-colors hover:bg-danger-50 hover:text-danger-600 active:scale-95"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Dropzone
            onFiles={handleUpload}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            title="Add samples"
            hint="JPG, PNG, WebP or PDF — up to 10MB each"
            busy={uploading}
            tone="magenta"
          />
        </div>
      </section>

      <Card className="mt-8">
        <CardTitle>Details</CardTitle>

        <div className="mt-5 space-y-5">
          <TextField label="Name customers see" value={displayName} onChange={setDisplayName} />
          <TextField label="City" value={city} onChange={setCity} />

          <TextAreaField
            label="About your work"
            value={bio}
            onChange={setBio}
            rows={3}
            placeholder="What you specialise in, and the kind of brands you work with."
          />

          <Field label="What you design" hint="This is how design requests are matched to you.">
            <div className="flex flex-wrap gap-2 pb-0.5">
              {DESIGN_SPECIALTIES.map((s) => (
                <Chip key={s.id} selected={specialties.includes(s.id)} onClick={() => toggleSpecialty(s.id)} title={s.tagline}>
                  {s.name}
                </Chip>
              ))}
            </div>
          </Field>

          {/* Number-ish fields keep digits and the decimal point only, as before. */}
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField
              label="Typical turnaround (days)"
              value={turnaround}
              onChange={(v) => setTurnaround(v.replace(/[^\d.]/g, ''))}
              inputMode="numeric"
            />
            <TextField label="Rate from (₱)" value={rateMin} onChange={(v) => setRateMin(v.replace(/[^\d.]/g, ''))} inputMode="decimal" />
            <TextField label="Rate to (₱)" value={rateMax} onChange={(v) => setRateMax(v.replace(/[^\d.]/g, ''))} inputMode="decimal" />
          </div>

          {/* Same message as the top of the page, repeated here so it is in view next to the button on a phone. */}
          <FormError>{error}</FormError>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} loading={saving} size="lg">
              Save changes
            </Button>
            {saved && (
              <span className="inline-flex animate-fade-in items-center gap-1.5 rounded-full bg-leaf-100 px-3 py-1.5 text-sm font-bold text-leaf-800">
                <Check className="h-4 w-4" strokeWidth={2.75} /> Saved
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
