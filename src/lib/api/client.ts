import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Turns a Supabase/Postgres error into the human-readable message the UI shows. */
export function friendlyError(error: { message: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const msg = error.message || fallback;
  // RAISE EXCEPTION messages from our RPCs are already written for end users.
  // Anything else (constraint names, PostgREST plumbing) gets the generic fallback.
  if (/^[A-Za-z].*[.!]$/.test(msg) && !msg.includes('constraint') && !msg.includes('violates')) {
    return msg;
  }
  if (msg.toLowerCase().includes('duplicate key')) return 'That already exists.';
  return fallback;
}
