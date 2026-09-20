# PrintAir PWA

The installable app version of PrintAir, the print-services marketplace for the Philippines. Customers post print and packaging projects, printing partners quote, the customer picks one, pays a small platform fee, and tracks the order to delivery. A second marketplace does the same for vetted freelance designers.

This is a **separate repo** from the PrintAir website (`printair_claude`). It has its own look, "Process", built on the four press inks, and it installs to a phone or desktop like a native app. It does everything the website does.

It is also **complete on its own**: the backend code (database migrations, security rules, edge functions, the backend test suites and the seed script) is mirrored here in [`supabase/`](supabase/README.md), `tests/` and `scripts/seed.mjs`, so the owner can compare the two front ends side by side and launch whichever one they choose. Read `supabase/README.md` before deploying anything from that folder — there is still only one live backend.

## How it relates to the website

| | Website (`printair_claude/landing`) | This repo |
|---|---|---|
| Screens, navigation, styling | Original cream-and-ember design | New "Process" design, phone-first, bottom tabs and sheets |
| Logic and data layer (`src/lib`, `src/contexts`) | Source | Carried over unchanged |
| Backend (Supabase schema, security rules, edge functions, PayMongo, emails) | Source, and for now the only repo backend changes are deployed from | Unchanged mirror in `supabase/` (copied 2026-09-20 from `acd1751`). Same live Supabase project |
| Accounts and data | Shared | Shared |

Because both front ends point at the same Supabase project, someone can start a project on the website and finish it in the app. When the database changes, change it in the website repo's `supabase/migrations/`, then copy the new migration and function files into this repo's `supabase/`, along with the regenerated `src/lib/api/database.types.ts` and any changed `src/lib/api/*.ts` files. (If this repo is chosen as the final one, that direction flips and `supabase/` here becomes the source of truth.)

## Try it with sample data (no backend needed)

On Windows, double-click **`Start PrintAir Demo.bat`**. Anywhere else:

```bash
npm install
npm run demo
```

The browser opens at `http://localhost:4180` with a yellow **Demo** button. Use it to switch between a visitor, a customer, a printing partner, a designer and an admin, and click through everything. The "backend" is a stand-in that runs inside the browser tab (`src/demo/`), so nothing is sent anywhere and no account is needed. What you do carries across roles — choose a quote as the customer, pay the mock platform fee, then switch to the partner and the job is in Active Projects — until you close the tab or press "Reset sample data". None of the demo code is included in a normal `npm run build`.

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

The unit tests cover the client-side validation and the dimensions parser. The backend suites that exercise row-level security, the database functions and the payment flow are in `tests/`; they need Docker and a local Supabase stack, so they run separately:

```bash
npx supabase start        # then copy API URL, anon key and service_role key into .env
npm run seed              # optional sample data
npm run test:backend      # refuses to run against anything but a local stack
```

## Deploy

Any static host works. Build command `npm run build`, output folder `dist`, and two build-time variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- **Cloudflare Pages:** `public/_redirects` (single-page-app rewrite) and `public/_headers` (no-cache on the service worker and manifest) are picked up automatically.
- **Netlify:** `netlify.toml` is included.
- **Vercel:** `vercel.json` is included.

An installable app must be served over **HTTPS**.

### Before you launch

1. **Legal pages.** `/privacy` and `/terms` are plain-language drafts that describe what the app really does with data. Fill in `src/data/legal.ts` (registered name, address, contact email, what happens to the platform fee on a cancelled order), have both pages checked by someone qualified in Philippine law, then set `reviewed: true`. Until then both pages show a "Draft" notice and the build prints a reminder.
2. **The "Inspiration" cards** use stock photographs and sample wording, so they are shown as "Ideas to start from". When you have real jobs to show (with the customer's permission), replace `INSPIRATION_ITEMS` in `src/data/catalog.ts` and set `STORIES_ARE_REAL = true` in `src/pages/LandingPage.tsx`; the section becomes "Made with PrintAir" with each customer's place and quote.
3. **`VITE_APP_URL`** (optional build variable): the app's public address. With it set, links shared on Facebook, Messenger or Viber show the PrintAir share picture (`public/share-card.png`, made from `brand/share-card.html`).

### Backend settings for the new address

The app runs on its own address (for example `app.printair.ph`). Two things on the backend know about addresses:

1. **Supabase → Authentication → URL Configuration:** add `https://<your-app-address>/reset-password` to the redirect URLs. Without it, password-reset emails requested from the app open the website instead.
2. **`SITE_URL` (edge function secret).** `create-booking-checkout` builds PayMongo's return link from `SITE_URL`, and `send-notifications` builds email links from it. While `SITE_URL` points at the website, a customer who pays from the app is sent back to the **website's** `/checkout/return` afterwards. The payment itself still settles (that happens by webhook, independent of where the browser goes) and the order shows as confirmed when they reopen the app, but the hand-off is not seamless, and if they are not signed in on the website that page cannot show their payment. Pick one:
   - **Serve this app at the `SITE_URL` address**, replacing the website there. Nothing else to do.
   - **Keep both.** Apply the small change in [`docs/BACKEND-FOLLOWUPS.md`](docs/BACKEND-FOLLOWUPS.md), which lets each front end say where to return to, checked against an allowlist.

Edge function CORS is already `*`, so the assistant and checkout calls work from any address.

## What makes it an app

- **Installable.** Web manifest, full icon set (standard, maskable, Apple touch), three home-screen shortcuts. "Get the app" is always on show — in the welcome page's header and footer, as a banner, and in the account menu — and hides itself only inside the installed app. Where the browser offers an install dialog (Chrome, Edge, Samsung Internet) it opens that; everywhere else it shows the two steps for that device (iPhone and iPad: Share → Add to Home Screen), because those browsers give a site no install button. On a dev server installing is off (no service worker), and the sheet says so.
- **Opens where you work.** The installed app starts at `/app`, which sends a signed-in person straight to their own workspace and everyone else to the welcome screen with sign-in open.
- **Works without a browser around it.** Every screen has its own way back, safe-area padding for the notch and home indicator, and no reliance on browser dialogs.
- **Honest offline behaviour.** The app shell, fonts and icons are cached so the app always opens. Supabase data, sign-in, file downloads, edge functions and PayMongo checkout are **never** cached (`vite.config.ts`, matched by path as well as host), because a stale quote or order status is worse than an error. Offline, screens say so and offer a retry.
- **Updates ask first.** A new version downloads in the background and shows "A new version of PrintAir is ready — Refresh", rather than reloading under someone halfway through a quote. An open app checks for updates hourly.

The logo is the supplied artwork in `brand/printair-mark-source.png`. `npm run icons` cuts it out onto a transparent background (`public/logo-mark.png`, used inside the app) and makes every icon size from it. Replace that one file and re-run to change the logo everywhere.

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
supabase/        backend mirror: migrations, edge functions, config (see supabase/README.md)
tests/           backend suites (npm run test:backend)
scripts/         make-icons.mjs, seed.mjs
docs/
  backend/                the website repo's engineering notes
  AGENT-HANDOFF.md        start here if you are picking this repo up (person or AI agent)
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
- The welcome page is one page rather than a stack of marketing sections. Left out on purpose, because they were decoration or sample content rather than features: the scrolling marquee, the navbar's scroll-spy and progress bar, the four sample partner cards with count-up statistics (the real directory is one tap away), and the "featured" builder preview card. Everything a visitor can *do* there is kept: start a project (from the hero, a category, or an idea card), filter the ideas, explore, reach both directories, join as a partner or designer, read how it works, and find the contact address.
- `/app` (the installed app's start address) did not exist on the website. Opened offline with a saved sign-in it shows the offline screen and recovers when the connection returns.

Last full parity pass against the website: 2026-09-20 (every page and stateful component compared function by function; `src/contexts` byte-identical, `src/lib` identical apart from a no-op regex escape and two added files).
