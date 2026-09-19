import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Building2, ChevronRight, Download, KeyRound, LayoutDashboard, LifeBuoy, LogIn, LogOut, Palette, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_HOME, ROLE_DASHBOARD_LABEL } from '@/routes/roles';
import { requestPasswordReset } from '@/lib/api/auth';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar, Badge } from '@/components/ui/bits';
import { useDialogs } from '@/components/ui/dialogs';
import { useInstall } from '@/pwa/install';
import { IosInstallSheet } from '@/pwa/InstallBanner';

const ROLE_NAME: Record<string, string> = {
  customer: 'Customer',
  partner: 'Printing partner',
  designer: 'Designer',
  admin: 'Admin',
};

function Row({
  icon: Icon,
  label,
  detail,
  onClick,
  tone = 'plain',
}: {
  icon: LucideIcon;
  label: string;
  detail?: ReactNode;
  onClick: () => void;
  tone?: 'plain' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3.5 rounded-2xl px-3 text-left transition-colors hover:bg-ink-50 active:bg-ink-100 ${
        tone === 'danger' ? 'text-danger-600' : 'text-ink-900'
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-danger-50' : 'bg-ink-100 text-ink-700'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {detail && <span className="block truncate text-sm text-ink-500">{detail}</span>}
      </span>
      <ChevronRight className="h-5 w-5 text-ink-300" />
    </button>
  );
}

/**
 * The account menu, as a sheet. Role-aware when signed in; offers sign-in and
 * the two ways to join when not. Also where the install option always lives,
 * even after the banner has been dismissed.
 */
export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, profile, openSignIn, openJoinPartner, openJoinDesigner, signOut } = useAuth();
  const { toast } = useDialogs();
  const { available, needsIosSteps, install } = useInstall();
  const navigate = useNavigate();
  const [iosOpen, setIosOpen] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const go = (to: string) => {
    onClose();
    navigate(to);
  };

  async function handleReset() {
    if (!profile || resetSent) return;
    try {
      await requestPasswordReset(profile.email);
      setResetSent(true);
      toast(`Reset link sent to ${profile.email}`);
    } catch {
      toast('Could not send the reset link. Please try again.', 'error');
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} size="sm" labelledBy="account-title">
        <div className="px-4 pb-5 pt-5 sm:px-5 sm:pt-6">
          {session && profile ? (
            <div className="flex items-center gap-4 px-2 pb-4 pr-12">
              <Avatar name={profile.full_name} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <h2 id="account-title" className="truncate text-xl text-ink-950">
                  {profile.full_name}
                </h2>
                <p className="truncate text-sm text-ink-500">{profile.email}</p>
                <div className="mt-1.5">
                  <Badge tone="grape" dot={false}>
                    {ROLE_NAME[profile.role] ?? profile.role}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-2 pb-4 pr-12">
              <h2 id="account-title" className="text-2xl text-ink-950">
                Welcome to PrintAir
              </h2>
              <p className="mt-1 text-ink-600">Log in to track projects, or join as a maker.</p>
            </div>
          )}

          <div className="space-y-0.5">
            {session && profile ? (
              <>
                <Row
                  icon={LayoutDashboard}
                  label={ROLE_DASHBOARD_LABEL[profile.role] ?? 'My projects'}
                  onClick={() => go(ROLE_HOME[profile.role] ?? '/dashboard')}
                />
                <Row icon={Printer} label="Browse printing partners" onClick={() => go('/partners')} />
                <Row icon={Palette} label="Browse designers" onClick={() => go('/designers')} />
                <Row
                  icon={KeyRound}
                  label={resetSent ? 'Reset link sent' : 'Send password reset link'}
                  detail={profile.email}
                  onClick={handleReset}
                />
              </>
            ) : (
              <>
                <Row
                  icon={LogIn}
                  label="Log in or sign up"
                  onClick={() => {
                    onClose();
                    openSignIn();
                  }}
                />
                <Row
                  icon={Building2}
                  label="Join as a Printing Partner"
                  detail="Receive matched print projects"
                  onClick={() => {
                    onClose();
                    openJoinPartner();
                  }}
                />
                <Row
                  icon={Palette}
                  label="Apply as a designer"
                  detail="Print-ready design commissions"
                  onClick={() => {
                    onClose();
                    openJoinDesigner();
                  }}
                />
              </>
            )}
            {available && (
              <Row
                icon={Download}
                label="Install the app"
                detail="Add PrintAir to your home screen"
                onClick={() => {
                  if (needsIosSteps) setIosOpen(true);
                  else void install();
                }}
              />
            )}
            <Row icon={LifeBuoy} label="Help" detail="How PrintAir works" onClick={() => go('/#how')} />
            {session && (
              <Row
                icon={LogOut}
                label="Sign out"
                tone="danger"
                onClick={async () => {
                  onClose();
                  await signOut();
                  navigate('/');
                }}
              />
            )}
          </div>
        </div>
      </Sheet>
      <IosInstallSheet open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}
