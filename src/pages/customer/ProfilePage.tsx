import { useEffect, useState } from 'react';
import { User, Phone, MapPin, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader, Avatar } from '@/components/ui/bits';
import { TextField } from '@/components/ui/Field';
import { FormError } from '@/components/ui/states';
import { useAuth } from '@/contexts/AuthContext';
import { updateMyProfile } from '@/lib/api/auth';
import { isValidMobile } from '@/lib/validation';

/**
 * A customer's own details, which until now they had no way to change.
 *
 * Partners have had /partner/profile and designers /designer/profile since the
 * start; customers got a projects list and nothing else, so a mistyped mobile
 * number at signup was permanent. The fields here are exactly the ones
 * updateMyProfile accepts — name, mobile, city — so nothing new is needed on
 * the backend.
 *
 * Email is deliberately not here. Changing the address you sign in with is an
 * account matter, not a profile one, and it needs a confirmation round-trip;
 * Settings shows it read-only until that exists.
 */
export default function CustomerProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The profile arrives a beat after the page does, so the fields fill in when
  // it lands rather than rendering empty and looking like lost data.
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setMobile(profile.mobile ?? '');
    setCity(profile.city ?? '');
  }, [profile]);

  const dirty =
    profile !== null &&
    (fullName !== (profile.full_name ?? '') || mobile !== (profile.mobile ?? '') || city !== (profile.city ?? ''));

  async function handleSave() {
    setError(null);
    if (!fullName.trim()) {
      setError('Enter your name.');
      return;
    }
    if (mobile.trim() && !isValidMobile(mobile)) {
      setError('Enter a valid Philippine mobile number, e.g. 0917 123 4567.');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        full_name: fullName.trim(),
        mobile: mobile.trim() || null,
        city: city.trim() || null,
      });
      await refreshProfile();
      setSaved(true);
    } catch {
      setError('Could not save your details. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="My profile" />

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={fullName || profile?.email || '?'} />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink-900">{fullName || 'Your name'}</p>
            <p className="truncate text-sm text-ink-500">{profile?.email}</p>
          </div>
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <TextField
            icon={User}
            name="full_name"
            autoComplete="name"
            label="Full name"
            placeholder="Juan dela Cruz"
            value={fullName}
            onChange={(v) => {
              setFullName(v);
              setSaved(false);
            }}
          />
          <TextField
            icon={Phone}
            type="tel"
            name="mobile"
            autoComplete="tel"
            label="Mobile number"
            hint="So a partner can reach you about a delivery. Optional."
            placeholder="0917 123 4567"
            value={mobile}
            onChange={(v) => {
              setMobile(v);
              setSaved(false);
            }}
          />
          <TextField
            icon={MapPin}
            name="city"
            autoComplete="address-level2"
            label="City"
            hint="Used to show you partners who deliver near you. Optional."
            placeholder="Quezon City"
            value={city}
            onChange={(v) => {
              setCity(v);
              setSaved(false);
            }}
          />
          <FormError>{error}</FormError>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={saving}
            disabled={!dirty || saving}
            icon={saved && !dirty ? <Check className="h-5 w-5" /> : undefined}
          >
            {saved && !dirty ? 'Saved' : 'Save changes'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
