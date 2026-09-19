import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/bits';
import { useAuth } from '@/contexts/AuthContext';
import { requestPasswordReset } from '@/lib/api/auth';

export default function PartnerSettingsPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResetPassword() {
    if (!profile) return;
    setSending(true);
    try {
      await requestPasswordReset(profile.email);
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Settings" />

      <Card>
        <p className="slug text-ink-500">Account email</p>
        <p className="mt-2 flex items-center gap-2.5 break-all font-bold text-ink-900">
          <Mail className="h-5 w-5 shrink-0 text-ink-400" /> {profile?.email}
        </p>
        <Button variant="secondary" fullWidth className="mt-5" onClick={handleResetPassword} loading={sending} disabled={sending || sent}>
          {sent ? 'Reset link sent' : 'Send password reset link'}
        </Button>
      </Card>

      <Button
        variant="danger"
        size="lg"
        fullWidth
        className="mt-5"
        onClick={async () => {
          await signOut();
          navigate('/');
        }}
        icon={<LogOut className="h-5 w-5" />}
      >
        Sign out
      </Button>
    </div>
  );
}
