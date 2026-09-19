import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_HOME } from '@/routes/roles';
import { PageLoader } from '@/components/ui/states';

/**
 * `/app` is the installed app's start URL. Someone signed in goes straight to
 * their own workspace; anyone else lands on the welcome screen with the
 * sign-in sheet already open, so launching the icon never dead-ends.
 */
export default function AppEntry() {
  const { session, profile, loading, openSignIn } = useAuth();

  useEffect(() => {
    if (!loading && !session) openSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  if (loading || (session && !profile)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-paper-200">
        <PageLoader />
      </div>
    );
  }
  if (!session || !profile) return <Navigate to="/" replace />;
  return <Navigate to={ROLE_HOME[profile.role] ?? '/dashboard'} replace />;
}
