import { useEffect, useState } from 'react';
import { Check, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField, TextAreaField, Field, Chip } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/bits';
import { FormError } from '@/components/ui/states';
import { useDialogs } from '@/components/ui/dialogs';
import { useAuth } from '@/contexts/AuthContext';
import { updatePartnerProfile, getPartnerCapabilities, setPartnerCapabilities } from '@/lib/api/partner';
import { validateBusinessProfile } from '@/lib/validation';
import { CATEGORIES } from '@/data/catalog';

const SERVICE_CATEGORIES = CATEGORIES.filter((c) => !c.isSpecial);

export default function BusinessProfilePage() {
  const { partnerProfile, refreshProfile } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [turnaround, setTurnaround] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [services, setServices] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useDialogs();

  useEffect(() => {
    if (!partnerProfile) return;
    setBusinessName(partnerProfile.business_name);
    setContactName(partnerProfile.contact_name);
    setCity(partnerProfile.city);
    setDescription(partnerProfile.description ?? '');
    setTurnaround(partnerProfile.typical_turnaround_days ? String(partnerProfile.typical_turnaround_days) : '');
    setServiceAreas(partnerProfile.service_areas.join(', '));
    setServices(partnerProfile.services.join(', '));
    getPartnerCapabilities(partnerProfile.id).then(setCategories);
  }, [partnerProfile]);

  const toggleCategory = (id: string) => {
    setCategories((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  async function handleSave() {
    if (!partnerProfile) return;
    setError(null);

    const parsedTurnaround = turnaround.trim() ? Number(turnaround) : null;
    const errors = validateBusinessProfile({
      businessName,
      contactName,
      city,
      typicalTurnaroundDays: parsedTurnaround,
    });
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    setSaving(true);
    setSaved(false);
    try {
      await updatePartnerProfile(partnerProfile.id, {
        business_name: businessName.trim(),
        contact_name: contactName.trim(),
        city: city.trim(),
        description: description || null,
        typical_turnaround_days: parsedTurnaround,
        service_areas: serviceAreas.split(',').map((s) => s.trim()).filter(Boolean),
        services: services.split(',').map((s) => s.trim()).filter(Boolean),
      });
      await setPartnerCapabilities(partnerProfile.id, categories);
      await refreshProfile();
      setSaved(true);
      toast('Profile saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (!partnerProfile) return null;

  // Presentational only: mirrors the four things isProfileComplete() looks at, read from the form as it stands.
  const checklist = [
    { label: 'Description', done: Boolean(description.trim()) },
    { label: 'Turnaround', done: Boolean(turnaround.trim() && Number(turnaround)) },
    { label: 'Categories', done: categories.length > 0 },
    { label: 'Service areas', done: serviceAreas.split(',').some((a) => a.trim()) },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Business Profile"
        subtitle="Customers see this when they view your profile. Better details mean better-matched opportunities."
      />

      <Card tone={allDone ? 'leaf' : 'sun'} className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-bold text-ink-950">{allDone ? 'Profile complete' : 'Finish your profile'}</p>
          <p className="font-display text-2xl font-extrabold text-ink-950">
            {doneCount}/{checklist.length}
          </p>
        </div>
        <div
          className="mt-3 grid grid-cols-4 gap-1.5"
          role="progressbar"
          aria-label="Profile completeness"
          aria-valuemin={0}
          aria-valuemax={checklist.length}
          aria-valuenow={doneCount}
        >
          {checklist.map((c) => (
            <span key={c.label} className={`h-2.5 rounded-full ${c.done ? (allDone ? 'bg-leaf-500' : 'bg-ink-950') : 'bg-ink-950/10'}`} />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
          {checklist.map((c) => (
            <li key={c.label} className={`flex items-center gap-1.5 text-sm font-bold ${c.done ? 'text-ink-950' : 'text-ink-500'}`}>
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  c.done ? 'bg-ink-950 text-white' : 'ring-2 ring-inset ring-ink-950/25'
                }`}
              >
                {c.done && <Check className="h-3 w-3" strokeWidth={3.5} />}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-3">
            <TextField label="Printing business name" value={businessName} onChange={setBusinessName} required />
            <TextField label="Contact person" value={contactName} onChange={setContactName} required />
            <TextField label="City" value={city} onChange={setCity} required />
            <TextField
              label="Typical turnaround (days)"
              type="number"
              inputMode="numeric"
              value={turnaround}
              onChange={setTurnaround}
              placeholder="e.g. 10"
            />
          </div>

          <TextAreaField
            label="Business description"
            value={description}
            onChange={setDescription}
            rows={3}
            placeholder="Tell customers what makes your shop unique."
          />

          <TextField
            label="Service areas (comma-separated)"
            value={serviceAreas}
            onChange={setServiceAreas}
            placeholder="Metro Manila, Cavite, Laguna"
          />
          <TextField
            label="Services / capabilities (comma-separated)"
            value={services}
            onChange={setServices}
            placeholder="Offset Printing, Die-Cutting"
          />

          <Field label="Print categories you serve" hint={<>You&apos;ll only see project opportunities in the categories you select here.</>}>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((cat) => (
                <Chip key={cat.id} selected={categories.includes(cat.id)} onClick={() => toggleCategory(cat.id)}>
                  {cat.name}
                </Chip>
              ))}
            </div>
          </Field>

          <FormError>{error}</FormError>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" onClick={handleSave} loading={saving} icon={<Save className="h-5 w-5" />}>
              Save profile
            </Button>
            {saved && (
              <span className="flex items-center justify-center gap-1.5 font-bold text-leaf-700" role="status">
                <CheckCircle2 className="h-5 w-5" /> Saved
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
