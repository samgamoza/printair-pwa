import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Role } from '@/lib/api/auth';
import { ROLE_HOME } from './roles';
import { PageLoader } from '@/components/ui/states';
import { Logo } from '@/components/ui/Marks';
import { Button } from '@/components/ui/Button';
import { useOnline } from '@/pwa/useOnline';
import OfflinePage from '@/pwa/OfflinePage';

function SuspendedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper-200 px-6 text-center">
      <Logo />
      <span className="mt-10 flex h-16 w-16 items-center justify-center rounded-3xl bg-danger-50 text-danger-600">
        <ShieldAlert className="h-8 w-8" />
      </span>
      <h1 className="mt-5 text-3xl text-ink-950">This account has been suspended</h1>
      <p className="mt-2 max-w-sm text-ink-600">Contact PrintAir support if you believe this is a mistake.</p>
      <Button variant="secondary" className="mt-8" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}

/** Gates a route to signed-in users, optionally to a specific role. */
export function ProtectedRoute({ role, children }: { role?: Role; children: React.ReactNode }) {
  const { session, profile, loading, openSignIn, refreshProfile } = useAuth();
  const location = useLocation();
  const online = useOnline();

  useEffect(() => {
    if (!loading && !session) openSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  // Opened with no connection: the saved sign-in is still there, but the profile could not be
  // fetched, so there is no role to route on. Fetch it the moment the connection returns.
  useEffect(() => {
    if (online && session && !profile && !loading) void refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper-200">
        <PageLoader />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!profile && !online) {
    return <OfflinePage />;
  }

  if (role && profile && profile.role !== role) {
    const home = ROLE_HOME[profile.role] ?? '/dashboard';
    return <Navigate to={home} replace />;
  }

  if (profile?.status === 'suspended') {
    return <SuspendedScreen />;
  }

  return <>{children}</>;
}
