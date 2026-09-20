/*
  Added in the PWA repo (not part of the suites carried over from the website).

  The backend suites sign up real accounts and move real orders. They are meant for a local
  Supabase stack (`npx supabase start`). This stops them before they touch anything else — for
  example when .env still points at the live project. It runs before tests/setup.ts.
*/
import { config } from 'dotenv';

config();

const url = process.env.VITE_SUPABASE_URL ?? '';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);

if (url && !isLocal && process.env.ALLOW_REMOTE_BACKEND_TESTS !== 'yes') {
  throw new Error(
    `Refusing to run the backend suites against ${url}. They create accounts and orders, so they only run against a local ` +
      'Supabase stack. Start one with `npx supabase start` and put its API URL, anon key and service_role key in .env.',
  );
}
