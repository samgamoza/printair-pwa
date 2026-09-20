import { config } from 'dotenv';

config();

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase env. Run `npx supabase start`, then copy the API URL and anon key into .env.',
  );
}

/*
  The designer suite additionally needs the service-role key, for the two
  things a browser genuinely cannot do: provisioning an admin (there is no
  public signup path to that role, by design) and settling a payment the way
  the PayMongo webhook does. Checked here rather than at first use so the
  failure is one clear message up front instead of an opaque mid-suite error.
*/
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Run `npx supabase status` and copy the service_role key into .env. ' +
      'It is server-side only and must never be exposed to the browser.',
  );
}
