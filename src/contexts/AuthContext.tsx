import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/api/client';
import {
  getMyProfile,
  getMyPartnerProfile,
  getMyDesignerProfile,
  signOut as apiSignOut,
  type Profile,
  type PartnerProfile,
  type DesignerProfile,
} from '@/lib/api/auth';

type AuthModalMode = 'closed' | 'sign-in' | 'join-partner' | 'join-designer';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  partnerProfile: PartnerProfile | null;
  designerProfile: DesignerProfile | null;
  loading: boolean;
  authModal: AuthModalMode;
  /**
   * `stayPut` suppresses the post-auth redirect for callers that are already
   * mid-task — the project builder, chiefly. Signing in from the navbar should
   * land you on your dashboard; signing in from step 6 of the builder should
   * leave you on step 6, with the answers you just gave still on screen.
   * Navigating away unmounts the builder and loses them.
   */
  openSignIn: (opts?: { stayPut?: boolean }) => void;
  openJoinPartner: () => void;
  openJoinDesigner: () => void;
  closeAuthModal: () => void;
  /** True when the current auth flow must not navigate on success. */
  authStayPut: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<PartnerProfile | null>(null);
  const [designerProfile, setDesignerProfile] = useState<DesignerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModal, setAuthModal] = useState<AuthModalMode>('closed');
  const [authStayPut, setAuthStayPut] = useState(false);

  // Takes the user id explicitly rather than calling supabase.auth.getUser()
  // internally — this runs from inside onAuthStateChange below, and any
  // GoTrueClient call made from there would re-enter its own session lock
  // and hang forever (a documented supabase-js gotcha).
  const loadProfile = useCallback(async (userId: string) => {
    const p = await getMyProfile(userId);
    setProfile(p);
    if (p?.role === 'partner') {
      setPartnerProfile(await getMyPartnerProfile(userId));
      setDesignerProfile(null);
    } else if (p?.role === 'designer') {
      setDesignerProfile(await getMyDesignerProfile(userId));
      setPartnerProfile(null);
    } else {
      setPartnerProfile(null);
      setDesignerProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await loadProfile(data.session.user.id);
  }, [loadProfile]);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      if (!cancelled) setLoading(false);
    });

    // Sync callback on purpose: onAuthStateChange runs while GoTrueClient
    // holds its session lock, so no `await` reaches another supabase.auth.*
    // call from here. The plain `.from()` queries inside loadProfile are
    // fine — only auth.* methods share that lock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setPartnerProfile(null);
        setDesignerProfile(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      partnerProfile,
      designerProfile,
      loading,
      authModal,
      authStayPut,
      openSignIn: (opts) => {
        setAuthStayPut(opts?.stayPut ?? false);
        setAuthModal('sign-in');
      },
      openJoinPartner: () => {
        setAuthStayPut(false);
        setAuthModal('join-partner');
      },
      openJoinDesigner: () => {
        setAuthStayPut(false);
        setAuthModal('join-designer');
      },
      closeAuthModal: () => setAuthModal('closed'),
      refreshProfile,
      signOut: async () => {
        await apiSignOut();
        setProfile(null);
        setPartnerProfile(null);
        setDesignerProfile(null);
      },
    }),
    [session, profile, partnerProfile, designerProfile, loading, authModal, authStayPut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
