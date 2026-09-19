import { supabase } from './client';

export type Role = 'customer' | 'partner' | 'designer' | 'admin';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  mobile: string | null;
  city: string | null;
  avatar_url: string | null;
  status: 'active' | 'suspended';
};

export type PartnerProfile = {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  city: string;
  description: string | null;
  typical_turnaround_days: number | null;
  service_areas: string[];
  services: string[];
  logo_url: string | null;
  portfolio_images: string[];
  status: 'active' | 'suspended';
};

/**
 * A designer's own workspace record.
 *
 * `status` carries the extra pre-approval gate partners do not have: a
 * designer sits at 'pending_review' until an admin decides, and only 'active'
 * receives work. The UI must treat anything else as "cannot yet trade".
 */
export type DesignerProfile = {
  id: string;
  user_id: string;
  display_name: string;
  city: string;
  bio: string | null;
  application_note: string | null;
  typical_turnaround_days: number | null;
  rate_min: number | null;
  rate_max: number | null;
  avatar_url: string | null;
  status: 'pending_review' | 'active' | 'rejected' | 'suspended';
  review_reason: string | null;
  reviewed_at: string | null;
};

/** Powers the email-first "Log in or sign up" screen — routes to password or account creation. */
export async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('email_exists', { p_email: email });
  if (error) throw error;
  return Boolean(data);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export type CustomerSignupInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  mobile?: string;
};

/**
 * Creates the auth user, profile, and (for partners) the partner workspace in
 * one atomic step — see handle_new_user() in the DB. If any part fails, the
 * whole signup fails; there is never an account left without a usable profile.
 */
export async function signUpCustomer(input: CustomerSignupInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: 'customer',
        first_name: input.firstName,
        last_name: input.lastName,
        mobile: input.mobile || null,
      },
    },
  });
  if (error) throw error;
  return data;
}

export type PartnerSignupInput = {
  email: string;
  password: string;
  contactName: string;
  businessName: string;
  city: string;
  mobile?: string;
  categories: string[];
  services?: string[];
};

export async function signUpPartner(input: PartnerSignupInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: 'partner',
        contact_name: input.contactName,
        business_name: input.businessName,
        city: input.city,
        mobile: input.mobile || null,
        categories: input.categories,
        services: input.services ?? [],
      },
    },
  });
  if (error) throw error;
  return data;
}

export type DesignerSignupInput = {
  email: string;
  password: string;
  displayName: string;
  city: string;
  mobile?: string;
  bio?: string;
  applicationNote?: string;
  specialties: string[];
};

/**
 * Creates the auth user, profile, and designer workspace atomically, same as
 * the partner path — but the resulting designer_profiles row opens at
 * 'pending_review'. Signing up is submitting an application, not joining; a
 * designer receives no work until an admin approves them.
 */
export async function signUpDesigner(input: DesignerSignupInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: 'designer',
        display_name: input.displayName,
        city: input.city,
        mobile: input.mobile || null,
        bio: input.bio || null,
        application_note: input.applicationNote || null,
        specialties: input.specialties,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function resetPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Accepts an explicit userId when the caller already has one (notably
 * AuthContext, reacting to onAuthStateChange). Calling supabase.auth.getUser()
 * from inside that callback would re-enter GoTrueClient's session lock and
 * deadlock — see https://github.com/supabase/auth-js/issues/873. Falling back
 * to getUser() here keeps this usable standalone elsewhere.
 */
export async function getMyProfile(userId?: string): Promise<Profile | null> {
  let id = userId;
  if (!id) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    id = auth.user.id;
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Profile;
}

export async function getMyPartnerProfile(userId?: string): Promise<PartnerProfile | null> {
  let id = userId;
  if (!id) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    id = auth.user.id;
  }
  const { data, error } = await supabase
    .from('partner_profiles')
    .select('*')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  return data as PartnerProfile | null;
}

/** Same userId caveat as getMyPartnerProfile — see the note there. */
export async function getMyDesignerProfile(userId?: string): Promise<DesignerProfile | null> {
  let id = userId;
  if (!id) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    id = auth.user.id;
  }
  const { data, error } = await supabase
    .from('designer_profiles')
    .select('*')
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  return data as DesignerProfile | null;
}

export async function updateMyProfile(patch: Partial<Pick<Profile, 'full_name' | 'mobile' | 'city' | 'avatar_url'>>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in.');
  const { error } = await supabase.from('profiles').update(patch).eq('id', auth.user.id);
  if (error) throw error;
}
