# PrintAir — temporary deployment to Supabase Cloud + Cloudflare Pages

**Purpose:** stand the app back up while the Proxmox host is down, for testing
only. No real customer data exists yet.

**What this replaces:** the local Supabase stack (`127.0.0.1:54321`) and the
Cloudflare Tunnel in CT 106 that served `printair.guma.one` and
`design.guma.one`. Both went down with the host.

> **Read §7 before you seed or share the URL.** A public deployment with the
> default seed data hands anyone who finds it an admin login.

---

## 0. What you are standing up

| Piece | Was | Becomes |
|---|---|---|
| Postgres + Auth + Storage | local Supabase on Proxmox | Supabase Cloud (free tier) |
| Edge Functions | local `supabase functions serve` | Supabase Cloud Functions |
| Static frontend | Vite dev/preview behind the tunnel | Cloudflare Pages |
| DNS | tunnel routes on `guma.one` | Pages custom domains |

Nothing in the app code changes. The only committed addition is
`landing/public/_redirects` (the SPA rewrite Pages needs — Netlify already had
its equivalent in `netlify.toml`).

---

## 1. Create the Supabase Cloud project

1. Go to <https://supabase.com/dashboard>, **New project**.
2. Region: **Southeast Asia (Singapore)** — closest to PH, lowest latency.
3. Set a strong database password and save it somewhere real.
4. Once provisioned, open **Project Settings → API** and copy:
   - **Project URL** → this becomes `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → server-side only, never goes in Pages env vars
5. From **Project Settings → General**, copy the **Reference ID** (20-char
   string). Called `<project-ref>` below.

Free tier caveat: the project **pauses after 7 days of inactivity** and needs a
click in the dashboard to resume. Fine for testing, surprising if you forget.

---

## 2. Push the schema

All 14 migrations replay in order and reproduce the schema exactly, including
the three storage buckets (`designer-portfolio`, `design-briefs`,
`design-deliverables`), which are created by
`20260810000400_designer_marketplace_rls.sql` — you do **not** create those by
hand.

```powershell
cd "D:\All Apps\Printair\landing"

npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` will list the migrations it is about to apply — confirm all 14 are
there before saying yes. Verify afterwards in **Table Editor**: you should see
`profiles`, `projects`, `quotes`, `orders`, plus the `design_*` and
`designer_*` tables.

---

## 3. Deploy the Edge Functions

```powershell
npx supabase functions deploy create-booking-checkout
npx supabase functions deploy paymongo-webhook
npx supabase functions deploy send-notifications
```

The CLI reads `verify_jwt` per function from `supabase/config.toml`, so the
webhook and dispatcher stay open to their own header-based auth while
`create-booking-checkout` keeps requiring a user JWT. Confirm in the dashboard
under **Edge Functions** that `paymongo-webhook` and `send-notifications` show
JWT verification **off** — if a CLI version ignores the config, redeploy those
two with `--no-verify-jwt`.

### Secrets

```powershell
npx supabase secrets set SITE_URL=https://printair.guma.one
npx supabase secrets set PAYMONGO_MOCK=true
npx supabase secrets set NOTIFY_DISPATCH_SECRET=<generate a long random string>
```

- `SITE_URL` must match the domain you land on in §6, or checkout return links
  point at the wrong host.
- `PAYMONGO_MOCK=true` keeps the stub checkout. See §7 — this is deliberate for
  testing and dangerous if you ever point real money at it.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
  injected automatically by the platform. Do not set them yourself.

---

## 4. Notification dispatch (optional for testing)

`20260810000100_schedule_notification_dispatch.sql` schedules a per-minute job
that drains the notification outbox. It reads its URL and secret from Vault and
**no-ops with a warning if they are absent**, so the migration is already safe
to have applied — skip this section entirely and nothing breaks, you just get
no notification emails.

To turn it on, run in the dashboard **SQL Editor**:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/send-notifications',
  'notify_dispatch_url'
);
select vault.create_secret('<the same NOTIFY_DISPATCH_SECRET from §3>', 'notify_dispatch_secret');
```

The secret must match the Edge Function's `NOTIFY_DISPATCH_SECRET` exactly or
every dispatch is rejected.

---

## 5. Frontend on Cloudflare Pages

1. **Workers & Pages → Create → Pages → Connect to Git**, choose
   `samgamoza/printair_claude`.
2. Build settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | **Root directory** | `landing` |

   The root directory matters — the repo has the app in `landing/`, not at the
   top level. Everything else is relative to it.

3. Environment variables (**Production**, and Preview if you want branch builds):

   ```
   VITE_SUPABASE_URL       = https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY  = <anon key>
   NODE_VERSION            = 22
   ```

   Never add `SUPABASE_SERVICE_ROLE_KEY` here. Anything prefixed `VITE_` is
   compiled into the browser bundle and is public by definition; the anon key
   is designed for that, the service-role key would hand over the whole
   database.

4. Deploy. You get `<something>.pages.dev` — check it loads before touching DNS.

---

## 6. Point the domains

Both hostnames must reach the same deployment: `App.tsx` selects the designer
landing page with `hostname.startsWith('design.')`, so `design.guma.one` is not
optional if you want that front door.

**Remove the stale tunnel routing first.** In **Zero Trust → Networks →
Tunnels**, open tunnel `guma_one` (`d70b9881-07f3-4287-9f29-5fd4c76bd3ee`) and
delete the public hostname routes for `printair.guma.one` and
`design.guma.one`. They point at a machine that is down, and they will fight
the Pages records if left in place. Also check **DNS** for leftover CNAMEs to
`*.cfargotunnel.com` and remove those.

Then in your Pages project → **Custom domains**, add both `printair.guma.one`
and `design.guma.one`. Cloudflare creates the DNS records and issues certs
automatically; give it a few minutes.

Finally, if you changed which host is canonical, make sure `SITE_URL` from §3
still matches.

---

## 7. Before you share the URL — read this

**The seed script publishes a known admin password.** `scripts/seed.mjs`
creates every account with the hardcoded password `PrintAir!2026`, including an
admin. It deliberately refuses non-local targets and only runs with
`--yes-production`. That guard exists for exactly this situation. On a public
URL, seeding as-is means anyone who finds the site can sign in as an
administrator.

Pick one:

- **Don't seed.** Sign up through the UI as you test. Cleanest option.
- **Seed with a changed password.** Edit the `PASSWORD` constant in
  `scripts/seed.mjs` to something private first, then:

  ```powershell
  $env:VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
  $env:VITE_SUPABASE_ANON_KEY="<anon key>"
  $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
  npm run seed -- --yes-production
  ```

  Do not commit the changed password.

**Mock payments are live.** With `PAYMONGO_MOCK=true`, `/checkout/mock/:orderId`
lets anyone mark an order paid without paying. Correct for testing, and the
reason this deployment must not take real orders. The webhook rejects mock
payloads whenever the server is not in mock mode, so switching to real PayMongo
keys closes it automatically.

**Consider Cloudflare Access.** If you only need the team to reach this, put a
Zero Trust Access policy in front of both hostnames. That makes the two points
above mostly moot.

---

## 8. Going back to Proxmox later

Nothing here is one-way. When the host is repaired:

- Point `.env` back at `http://127.0.0.1:54321` for local dev.
- Either keep the hosted project as a staging environment, or
  `npx supabase unlink` and restore the tunnel routes.
- `public/_redirects` is harmless everywhere — Netlify and Pages both read it,
  and a plain Vite preview ignores it.

Since there is no real data, there is nothing to migrate back.
