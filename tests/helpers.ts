import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;

/** A fresh, signed-out client. Each test user gets their own so sessions never mix. */
export function freshClient(): SupabaseClient {
  return createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let counter = 0;
export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}.${process.pid}.${counter}@printair.test`;
}

export const PASSWORD = 'PrintAir!2026';

export async function signUpCustomer(opts: {
  email: string;
  firstName: string;
  lastName: string;
  mobile?: string;
}): Promise<SupabaseClient> {
  const client = freshClient();
  const { error } = await client.auth.signUp({
    email: opts.email,
    password: PASSWORD,
    options: {
      data: {
        role: 'customer',
        first_name: opts.firstName,
        last_name: opts.lastName,
        mobile: opts.mobile ?? null,
      },
    },
  });
  if (error) throw new Error(`customer signup failed: ${error.message}`);
  return client;
}

export async function signUpPartner(opts: {
  email: string;
  contactName: string;
  businessName: string;
  city: string;
  mobile?: string;
  categories: string[];
  services?: string[];
}): Promise<SupabaseClient> {
  const client = freshClient();
  const { error } = await client.auth.signUp({
    email: opts.email,
    password: PASSWORD,
    options: {
      data: {
        role: 'partner',
        contact_name: opts.contactName,
        business_name: opts.businessName,
        city: opts.city,
        mobile: opts.mobile ?? null,
        categories: opts.categories,
        services: opts.services ?? [],
      },
    },
  });
  if (error) throw new Error(`partner signup failed: ${error.message}`);
  return client;
}

export async function myPartnerId(client: SupabaseClient): Promise<string> {
  // The directory is public, so this must be scoped to the signed-in user.
  const { data: user } = await client.auth.getUser();
  const { data, error } = await client
    .from('partner_profiles')
    .select('id')
    .eq('user_id', user.user!.id)
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function signUpDesigner(opts: {
  email: string;
  displayName: string;
  city: string;
  specialties: string[];
  bio?: string;
  applicationNote?: string;
}): Promise<SupabaseClient> {
  const client = freshClient();
  const { error } = await client.auth.signUp({
    email: opts.email,
    password: PASSWORD,
    options: {
      data: {
        role: 'designer',
        display_name: opts.displayName,
        city: opts.city,
        specialties: opts.specialties,
        bio: opts.bio ?? null,
        application_note: opts.applicationNote ?? null,
      },
    },
  });
  if (error) throw new Error(`designer signup failed: ${error.message}`);
  return client;
}

export async function myDesignerId(client: SupabaseClient): Promise<string> {
  const { data: user } = await client.auth.getUser();
  const { data, error } = await client
    .from('designer_profiles')
    .select('id')
    .eq('user_id', user.user!.id)
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * A service-role client.
 *
 * Used for exactly two things the browser legitimately cannot do: provisioning
 * the admin account (no public signup path by design), and standing in for the
 * PayMongo webhook, which is the only actor allowed to settle a payment. Never
 * used to shortcut a flow that a real user has to perform — those all go
 * through the anon key so RLS is actually exercised.
 */
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for the designer suite (admin provisioning + payment settlement). ' +
        'Copy it from `npx supabase status` into .env.',
    );
  }
  return createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Creates an admin and returns a client signed in as them.
 *
 * 'admin' has to come from app_metadata: handle_new_user() only trusts an
 * admin role from there, precisely because it is the one field a public
 * auth.signUp() can never set. Same path scripts/seed.mjs uses.
 */
export async function createAdmin(): Promise<SupabaseClient> {
  const email = uniqueEmail('admin');
  const svc = serviceClient();
  const { error } = await svc.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { full_name: 'Test Admin' },
  });
  if (error) throw new Error(`admin create failed: ${error.message}`);

  const client = freshClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`admin sign-in failed: ${signInError.message}`);
  return client;
}

/**
 * Stands in for paymongo-webhook, which runs as service_role and is the only
 * thing permitted to move an order out of AWAITING_PAYMENT.
 *
 * Deliberately not invoking the Edge Function: see the known local
 * edge-runtime flake documented at the top of marketplace.test.ts. What these
 * tests need is the post-payment state, not the HTTP hop — the hop itself is
 * covered by its own dedicated test, which is allowed to fail alone.
 *
 * Idempotent by design. It no-ops if the order has already moved on, so it is
 * safe to call defensively after a test that may or may not have got there.
 * Without that guard a second call would append a duplicate CONFIRMED event
 * and break the timeline assertions.
 */
async function settle(
  orderId: string,
  tables: { orders: string; payments: string; events: string },
): Promise<void> {
  const svc = serviceClient();

  const { data: order, error: readErr } = await svc
    .from(tables.orders)
    .select('status')
    .eq('id', orderId)
    .single();
  if (readErr) throw readErr;
  if (order.status !== 'AWAITING_PAYMENT') return; // already settled

  const { error: payErr } = await svc
    .from(tables.payments)
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('order_id', orderId);
  if (payErr) throw payErr;

  // Conditional on the status so two concurrent callers cannot both transition.
  const { data: moved, error: orderErr } = await svc
    .from(tables.orders)
    .update({ status: 'CONFIRMED' })
    .eq('id', orderId)
    .eq('status', 'AWAITING_PAYMENT')
    .select('id')
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!moved) return;

  const { error: eventErr } = await svc.from(tables.events).insert({
    order_id: orderId,
    status: 'CONFIRMED',
    note: 'Platform fee received — order confirmed.',
    created_by: null,
  });
  if (eventErr) throw eventErr;
}

export function settleDesignPayment(orderId: string): Promise<void> {
  return settle(orderId, {
    orders: 'design_orders',
    payments: 'design_payments',
    events: 'design_order_status_events',
  });
}

export function settleBookingPayment(orderId: string): Promise<void> {
  return settle(orderId, {
    orders: 'orders',
    payments: 'booking_payments',
    events: 'order_status_events',
  });
}
