# PrintAir PWA

The installable app version of PrintAir, the print-services marketplace for the Philippines. Customers post print and packaging projects, printing partners quote, the customer picks one, pays a small platform fee, and tracks the order to delivery. A second marketplace does the same for vetted freelance designers.

This is a **separate repo** from the PrintAir website (`printair_claude`). It has its own look, "Process", built on the four press inks, and it installs to a phone or desktop like a native app. It does everything the website does.

## How it relates to the website

| | Website (`printair_claude/landing`) | This repo |
|---|---|---|
| Screens, navigation, styling | Original cream-and-ember design | New "Process" design, phone-first, bottom tabs and sheets |
| Logic and data layer (`src/lib`, `src/contexts`) | Source | Carried over unchanged |
| Backend (Supabase schema, security rules, edge functions, PayMongo, emails) | **Lives there, and only there** | None. Uses the same Supabase project |
| Accounts and data | Shared | Shared |

Because both front ends point at the same Supabase project, someone can start a project on the website and finish it in the app. When the database changes, change it in the website repo's `supabase/migrations/`, then copy the regenerated `src/lib/api/database.types.ts` and any changed `src/lib/api/*.ts` files here.

## Try it with sample data (no backend needed)

On Windows, double-click **`Start PrintAir Demo.bat`**. Anywhere else:

```bash
npm install
npm run demo
```

The browser opens on the app with a yellow **Demo** button. Use it to switch between a visitor, a customer, a printing partner, a designer and an admin, and click through everything. The "backend" is a stand-in that runs inside the browser tab (`src/demo/`), so nothing is sent anywhere and no account is needed. What you do carries across roles — choose a quote as the customer, pay the mock platform fee, then switch to the partner and the job is in Active Projects — until you close the tab or press "Reset sample data". None of the demo code is included in a normal `npm run build`.

## Run it against the real backend

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env     # then fill in the two values — the same ones the website uses
npm run dev
```

To try the install prompt, offline behaviour and update flow, use a production build, since the service worker is off in dev:

```bash
npm run build
npm run preview          # http://localhost:4175
```

## Checks

```bash
npm run check            # lint + typecheck + unit tests + build
```

The unit tests cover the client-side validation and the dimensions parser. The end-to-end suites that exercise row-level security stay with the backend, in the website repo.

## Deploy

Any static host works. Build command `npm run build`, output folder `dist`, and two build-time variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- **Cloudflare Pages:** `public/_redirects` (single-page-app rewrite) and `public/_headers` (no-cache on the service worker and manifest) are picked up automatically.
- **Netlify:** `netlify.toml` is included.
- **Vercel:** `vercel.json` is included.

An installable app must be served over **HTTPS**.

### Backend settings for the new address

The app runs on its own address (for example `app.printair.ph`). Two things on the backend know about addresses:

1. **Supabase → Authentication → URL Configuration:** add `https://<your-app-address>/reset-password` to the redirect URLs. Without it, password-reset emails requested from the app open the website instead.
2. **`SITE_URL` (edge function secret).** `create-booking-checkout` builds PayMongo's return link from `SITE_URL`, and `send-notifications` builds email links from it. While `SITE_URL` points at the website, a customer who pays from the app is sent back to the **website's** `/checkout/return` afterwards. The payment itself still settles (that happens by webhook, independent of where the browser goes) and the order shows as confirmed when they reopen the app, but the hand-off is not seamless, and if they are not signed in on the website that page cannot show their payment. Pick one:
   - **Serve this app at the `SITE_URL` address**, replacing the website there. Nothing else to do.
   - **Keep both.** Apply the small change in [`docs/BACKEND-FOLLOWUPS.md`](docs/BACKEND-FOLLOWUPS.md), which lets each front end say where to return to, checked against an allowlist.

Edge function CORS is already `*`, so the assistant and checkout calls work from any address.

## What makes it an app

- **Installable.** Web manifest, full icon set (standard, maskable, Apple touch), three home-screen shortcuts. An install banner appears where the browser allows it; on iPhone and iPad it shows the two Share-sheet steps instead, because Safari offers no install button. The option also lives permanently in the account menu.
- **Opens where you work.** The installed app starts at `/app`, which sends a signed-in person straight to their own workspace and everyone else to the welcome screen with sign-in open.
- **Works without a browser around it.** Every screen has its own way back, safe-area padding for the notch and home indicator, and no reliance on browser dialogs.
- **Honest offline behaviour.** The app shell, fonts and icons are cached so the app always opens. Supabase data, sign-in, file downloads, edge functions and PayMongo checkout are **never** cached (`vite.config.ts`, matched by path as well as host), because a stale quote or order status is worse than an error. Offline, screens say so and offer a retry.
- **Updates ask first.** A new version downloads in the background and shows "A new version of PrintAir is ready — Refresh", rather than reloading under someone halfway through a quote. An open app checks for updates hourly.

Regenerate icons after changing the mark with `npm run icons`.

## Where things are

```
src/
  lib/            data layer, validation, pricing, dimensions  (shared with the website — don't fork)
  contexts/       sign-in state                                (shared with the website)
  data/catalog.ts print categories, materials, specialties
  components/ui/  the Process design kit
  components/shell/  AppShell (tabs / side rail), PublicShell, AccountSheet
  pages/          one folder per role, plus public pages
  pwa/            install prompt, update toast, offline screen, /app entry
docs/
  DESIGN-SYSTEM.md        tokens, kit, patterns, and the rules that keep parity
  FEATURE-INVENTORY.md every feature, as a checklist against the original
```

## Differences from the website, on purpose

- Browser `confirm()` / `prompt()` / `alert()` are replaced by designed sheets and toasts. Each still exists, and reasons are still required where they were.
- A selected printing partner can now download the customer's artwork from Active Projects. The original promised this and the database already allowed it, but no screen offered it.
- Quote and proposal comparison adds "Lowest price" and "Fastest" labels when there is more than one offer. They state facts; the customer still chooses.
- Public directories add search and category filters over the already-loaded list.
- A global "You're offline" strip and an offline screen for signed-in areas.
- Help in the account menu goes to "How it works" (in the original it did nothing).
- "Send password reset link" is in every role's account menu (the original offered it only in Partner Settings).
- Public profiles gain a call to action: "Start a project" on a partner, "Request a design" on a designer (customers and visitors only).
- Starting a design request from anywhere in the customer area moves to My Designs first, so the new request is on screen when the form closes.
