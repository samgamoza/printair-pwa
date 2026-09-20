# PrintAir backend (mirror)

Everything PrintAir runs on the server: the database schema, the security rules (row-level security), the database functions that hold the business logic, and four edge functions.

```
config.toml          local stack settings for the Supabase CLI
migrations/          16 SQL migrations, applied in order — schema, functions, RLS, payments, notifications, designer marketplace
functions/
  create-booking-checkout   starts the PayMongo checkout for a platform fee (mock mode when PAYMONGO_MOCK=true)
  paymongo-webhook          settles a payment when PayMongo confirms it
  send-notifications        sends the queued emails (Resend)
  chat-assistant            the PrintAir Assistant (Groq), with a scripted fallback
  _shared/                  cors, paymongo, resend, groq, email templates
../tests/            the suites that prove the rules hold (npm run test:backend)
../scripts/seed.mjs  realistic Philippine sample data for a local stack (npm run seed)
../docs/backend/     the website repo's engineering notes
```

## Read this before you deploy anything from here

This folder was copied, unchanged, from the website repo (`printair_claude` @ `acd1751`, 2026-09-20) so that this repo is complete on its own and either front end can become the one that launches.

**There is still only one live backend**: one Supabase project, used by the website and by this app. Copying the code did not create a second one. So:

- Pick **one** repo to deploy backend changes from, and only that one. Until the owner decides which front end launches, that is the **website repo**. Running `supabase db push` or `supabase functions deploy` from both will, sooner or later, put the live database out of step with one of them.
- If the backend changes in the website repo, copy the new migration / function files here too (and the regenerated `src/lib/api/database.types.ts`), so the mirror stays true.
- When the owner chooses this repo as the final one, this folder becomes the source of truth and the note above can go.

Secrets are not in this folder and must never be: `functions/.env`, `supabase/.temp` and `.notify-secret.tmp` are git-ignored. The live function secrets (`PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYMONGO_MOCK`, `RESEND_API_KEY`, `NOTIFY_FROM`, `NOTIFY_DISPATCH_SECRET`, `GROQ_API_KEY`, `SITE_URL`) live in the Supabase dashboard.

## Run it locally

Needs Docker Desktop.

```bash
npx supabase start          # builds a local stack from migrations/
npx supabase status         # copy API URL, anon key and service_role key into .env
npm run seed                # optional: sample accounts and data
npm run dev                 # the app against your local stack
npm run test:backend        # the security and payment suites (local stack only — they refuse anything else)
```
