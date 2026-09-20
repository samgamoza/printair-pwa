# PrintAir PWA — agent handoff

Written 2026-09-20 for whoever (person or AI agent) picks this repo up next. It assumes you have read nothing else. Read this first, then `README.md`, then `docs/DESIGN-SYSTEM.md` before touching a screen.

If something here disagrees with the code, the code wins — fix this file in the same change.

---

## 1. What this is, in one minute

PrintAir is a print-services marketplace for the Philippines. A customer posts a print or packaging project, vetted printing partners quote, the customer picks one, pays PrintAir a 5% platform fee through PayMongo, and tracks the order to delivery. A second marketplace does the same for freelance designers (design request → proposals → deliverables → review).

There are **two front ends on one backend**:

| | The website (original) | This repo (the PWA) |
|---|---|---|
| Location on the owner's PC | `D:\All Apps\Printair` (app in `landing/`) | `D:\All Apps\printair-pwa` |
| Upstream name / baseline | `printair_claude` @ `acd1751` | carried over from that commit |
| Look | cream-and-ember | "Process" (CMYK press inks), phone-first |
| Backend | **owns it**: Supabase migrations, RLS, RPCs, edge functions, PayMongo, emails | none — front end only, same Supabase project |

The owner's brief, in order: make an installable PWA as a **totally separate repo**; give it a **totally different UI/UX**; **keep every feature**; keep the backend on Supabase, shared, unchanged. After a failed try with Base44 the owner said "follow your best instincts… make it the best" and later supplied their own logo ("use this as the logo, as-is").

Four roles, all in scope: **customer, partner (printing), designer, admin**.

## 2. Hard rules (do not break these without the owner saying so)

1. **Never modify `D:\All Apps\Printair`.** It is the website and the backend's source of truth. Read it for reference only.
2. **No backend changes from this repo.** No migrations, no edge functions, no service-role key, ever. If the app needs a backend change, write it up in `docs/BACKEND-FOLLOWUPS.md` for the website repo and tell the owner.
3. **Logic is frozen; only presentation is ours.** `src/lib/**` and `src/contexts/**` are carried over byte-for-byte in intent. State, effects, handlers, API calls, validation, routes, status values and the order things happen in stay as the original had them. When the website's data layer changes, copy the regenerated `src/lib/api/database.types.ts` and changed `src/lib/api/*.ts` over — don't fork them.
4. **Every feature stays.** `docs/FEATURE-INVENTORY.md` is the checklist: every field, button, state (loading / empty / error / not-found) and piece of helper copy from the original must still exist. Deliberate differences are listed at the bottom of `README.md`; add to that list when you make one.
5. **No browser dialogs.** `confirm()` / `prompt()` / `alert()` are replaced by `useDialogs()` (`confirm`, `askReason`, `toast`). Control flow stays identical: `if (!(await confirm({...}))) return;`.
6. **Use the design kit** (`src/components/ui`). Don't hand-roll buttons, inputs, cards, loaders, empty or error states. Old tokens (`ember-*`, `teal-*`, `glass`, lucide `Loader2` spinners…) no longer exist.
7. **The logo is the owner's artwork, used as-is.** Don't redraw, recolour or crop it. See §7.
8. **Supabase, auth, files, edge functions and PayMongo are never cached** by the service worker. A stale quote or order status is worse than an error.
9. **`lucide-react` must stay pre-bundled** (`optimizeDeps.include`). Excluding it serves ~1,400 icon files in dev and ad blockers block some by name (`fingerprint.js`), which blanks the whole app. This was a real user-reported bug.
10. **Commit on the owner's machine with the agreed trailer** (see §10) and never commit `.env*` (only `.env.example`).

## 3. Stack

Vite 8 · React 18 · TypeScript ~5.9 · Tailwind 3 · react-router-dom 7 · `@supabase/supabase-js` 2 · lucide-react **0.344** (older set: no `Ellipsis`, `SquarePlus` — use `MoreHorizontal`, `PlusSquare`) · vite-plugin-pwa 1.3 (Workbox, `registerType: 'prompt'`) · fonts via `@fontsource-variable` (Bricolage Grotesque `wdth` axis, Figtree) · vitest · sharp (icons only).

`.npmrc` has `legacy-peer-deps=true`; without it npm 10 fails on peer resolution (`Cannot read properties of null (reading 'edgesOut')` / ERESOLVE). Node 20+.

## 4. Commands

```bash
npm install
npm run demo        # http://localhost:4180 — fake in-browser backend, role switcher. Windows: "Start PrintAir Demo.bat"
npm run dev         # real Supabase; needs .env (same two values as the website)
npm run build && npm run preview   # http://localhost:4175 — the only way to see install / offline / update locally
npm run check       # lint + typecheck + 76 unit tests + build. Must pass before every commit.
npm run icons       # regenerate public/logo-mark.png and all icons from brand/printair-mark-source.png
```

`npm run check` currently reports one pre-existing lint **warning** (react-refresh, a file exporting a constant next to components). Zero errors is the bar.

Environment variables (build time): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (required); `VITE_APP_URL` (optional, the app's public https address, no trailing slash — makes shared links show `public/share-card.png`).

## 5. Map of the repo

```
index.html                 boot screen inside #root + window.__printairBootError (never a silent blank page); share/OG tags (__APP_URL__ is replaced at build)
vite.config.ts             demo-mode defines, VitePWA manifest + Workbox rules, preload injection plugin, legal-draft build warning, lucide pre-bundle
public/                    logo-mark.png, icons/, apple-touch-icon.png, share-card.png, robots.txt, _headers, _redirects
brand/                     printair-mark-source.png (the owner's logo), share-card.html (source of share-card.png)
scripts/make-icons.mjs     cuts the logo out of its painted-in checkerboard backdrop, writes logo + every icon
netlify.toml vercel.json   SPA rewrites + no-cache on sw.js / manifest for those hosts (Cloudflare uses public/_redirects, _headers)
docs/                      this file, DESIGN-SYSTEM.md, FEATURE-INVENTORY.md, BACKEND-FOLLOWUPS.md

src/main.tsx               async start(): demo backend first if VITE_DEMO, then dynamic-imports the app; ErrorBoundary > BrowserRouter > AuthProvider > DialogsProvider
src/App.tsx                all routes. Every page except LandingPage is React.lazy; <Suspense> wraps <Routes>
src/lib/        FROZEN     api/* (one file per domain, Supabase client, database.types.ts), validation, dimensions, pricing (BOOKING_FEE_PCT = 5, display only), format.ts (ours: formatDate parses date-only values as local; peso)
src/contexts/   FROZEN     AuthContext: session, profile, openSignIn / openJoinPartner / openJoinDesigner, auth modal state
src/data/catalog.ts        print categories, materials, INSPIRATION_ITEMS (stock photos + sample quotes — see §8)
src/data/legal.ts          owner-supplied facts for /privacy and /terms; `reviewed: false` shows a Draft banner
src/routes/                roles.ts (ROLE_HOME), ProtectedRoute.tsx
src/components/ui/         THE KIT: Button, Sheet, dialogs, Field, Card, states, bits, Timeline, Dropzone, Rail, Marks (logo + press ornaments)
src/components/shell/      AppShell (bottom tabs + raised create button + "More" sheet on phones, ink side rail on desktop), PublicShell, AccountSheet
src/components/marketing/  Chrome.tsx — MarketingHeader / MarketingFooter for the two landing pages
src/components/auth/       AuthModal (multi-step: email → password / customer signup / partner signup / designer application / reset)
src/components/dashboard/  forms, timelines, StatusBadge set shared by role pages
src/components/            ProjectBuilder, DesignRequestBuilder, Assistant (calls edge function `chat-assistant`), ErrorBoundary; Button.tsx and Modal.tsx are thin re-exports kept so carried-over imports resolve
src/pages/                 LandingPage, DesignLandingPage, LegalPage, directories + public profiles, ResetPasswordPage, checkout/, and one folder per role (customer, partner, designer, admin)
src/pwa/                   install.ts (captures beforeinstallprompt at module load; `how`: prompt | ios | android | desktop), InstallPrompt.tsx (InstallSheet, GetAppButton, InstallBanner), UpdateToast, OfflinePage, AppEntry (/app → role home), useOnline
src/demo/                  install.ts (patches window.fetch to emulate PostgREST, RPCs, auth, storage, edge functions), fixtures.ts, DemoSwitcher.tsx. Loaded ONLY when VITE_DEMO=1; verified absent from production builds
```

### Routes

Public: `/` (LandingPage, or DesignLandingPage when the hostname starts with `design.`), `/design`, `/partners`, `/partners/:id`, `/designers`, `/designers/:id`, `/privacy`, `/terms`, `/reset-password`, `/checkout/mock/:orderId`, `/checkout/return`, `/app` (installed-app entry → role home or landing with sign-in open), `/offline`.
Customer `/dashboard`: index (projects), `projects/:id`, `designs`, `designs/:id`. `?new=1` on `/dashboard` and `/dashboard/designs` opens the matching builder (used by home-screen shortcuts).
Partner `/partner`: index, `opportunities`, `opportunities/:id`, `quotes`, `projects`, `completed`, `profile`, `settings`.
Designer `/designer`: index, `opportunities`, `opportunities/:id`, `orders`, `profile`.
Admin `/admin`: index (users), `providers`, `designers`, `projects`, `quotes`, `reviews`, `design-reviews`.

Role layouts render `AppShell` once with `<Suspense><Outlet/></Suspense>` so tabs stay on screen while a page's code loads. `CustomerLayout` owns both builders and exposes `useCreate()` → `{ startProject, startDesign, version }`; `startDesign` navigates to `/dashboard/designs` first so the new request is visible when the form closes.

### Backend surface the app calls (all defined in the website repo)

RPCs: `submit_project`, `cancel_project`, `submit_quote`, `withdraw_quote`, `select_quote`, `update_order_status`, `create_review`, `submit_design_request`, `cancel_design_request`, `submit_design_proposal`, `withdraw_design_proposal`, `select_design_proposal`, `submit_design_deliverable`, `review_design_deliverable`, `update_design_order_status`, `create_design_review`, `email_exists`, `admin_set_account_status`, `admin_review_designer`, `admin_moderate_review`, `admin_moderate_design_review`.
Edge functions: `create-booking-checkout`, `paymongo-webhook` (called by the mock checkout page only; rejected server-side unless `PAYMONGO_MOCK=true`), `chat-assistant`, plus `send-notifications` server-side.
Payment model: only the platform fee goes through the app. For print, the job price is paid directly to the partner, off-platform. The charged amount comes from the database (`booking_payments.amount`); `BOOKING_FEE_PCT` is display-only.

## 6. The design system in brief ("Process")

Full contract: `docs/DESIGN-SYSTEM.md`. The essentials: neutrals are `ink-*`, app background `paper-200`, cards plain white. `magenta` = create actions and moments that matter (accent buttons are `magenta-600` for contrast), `cyan` = info / selected / focus ring, `sun` = attention and "waiting on you", `grape` = in progress / designer side, `leaf` = success, `danger` = destructive. Radii: cards `rounded-3xl`, tiles and sheets `rounded-4xl`, controls `rounded-2xl`, buttons and chips `rounded-full`. Design at 390px first, then make 1280px look deliberate; touch targets ≥ 44px; never build a screen out of `text-xs`.

`Sheet` is the only overlay (bottom sheet on phones, dialog on desktop) and keeps a module-level open-sheet counter for scroll lock — stacked sheets once left the page locked, don't regress it. Field `onChange` handlers take the **string value**, not an event. `Rail` is the horizontal card row with arrows from `sm` up and edge fades.

Reference implementations to copy from: `pages/customer/ProjectsListPage.tsx` (list), `pages/customer/ProjectDetailPage.tsx` (detail), `components/ProjectBuilder.tsx` (multi-step flow), `components/DesignRequestBuilder.tsx` (form in a sheet), `pages/customer/CustomerLayout.tsx` (role layout).

## 7. Brand

The logo is the owner's navy-and-orange paper plane. The supplied PNG had a fake transparency checkerboard painted in; `scripts/make-icons.mjs` flood-fills that backdrop from the edges to real transparency, writes `public/logo-mark.png` (256px) and cuts all icons from the full-size source. `PlaneGlyph` is the bare mark, `LogoMark` puts it on a **white tile always** (the navy body disappears on the dark side rail), `Logo` adds the wordmark. "Air" in the wordmark takes the logo's orange — `#f97a1f` on dark, a deeper `#d9570a` on light for contrast — and orange is used nowhere else in the UI. App icons are the mark on a white tile; maskable icons keep it inside the safe zone. `public/share-card.png` is a 1200×630 screenshot of `brand/share-card.html` (serve the repo root locally and screenshot at that size to regenerate).

## 8. PWA behaviour

- **Manifest** in `vite.config.ts`: `start_url: /app`, theme/background `#f6f5fa`, four icons, three shortcuts (new project, my projects, opportunities).
- **Service worker**: precaches the build (all lazy chunks too, so every screen opens offline), `navigateFallback: /index.html`, `NetworkOnly` for anything matching `/(rest|auth|storage|functions|realtime)/v1/` or Supabase / PayMongo hosts, `StaleWhileRevalidate` for `images.pexels.com`. Off in dev and demo; demo mode also unregisters any old worker.
- **Updates ask first**: `UpdateToast` shows "A new version is ready — Refresh"; an open app re-checks hourly.
- **Install**: "Get the app" is always visible (landing header and footer, `InstallBanner`, account menu) and hides only inside the installed app. If the browser fired `beforeinstallprompt` it opens the native dialog; otherwise `InstallSheet` shows steps for iOS / Android / desktop. In dev the sheet says installing is off locally.
- **Offline**: a global "You're offline" strip, and `OfflinePage` for signed-in areas with retry.
- **Performance**: only `LandingPage` is eager; `ProjectBuilder` and `Assistant` lazy-load on the landing page (builder warmed after 1.5 s); a small Vite plugin injects `modulepreload` for the App / AuthContext / dialogs chunks and `preload` for the two fonts.
- Last Lighthouse run on the production build (simulated slow phone, 2026-09-19): performance 90, accessibility 100, best practices 100, SEO 100.

## 9. Demo mode (how the owner reviews work)

`npm run demo` → Vite `--mode demo` on **port 4180, strictPort**. `vite.config.ts` injects `VITE_DEMO=1`, a deliberately unreachable Supabase URL (`https://demo.printair.invalid`) and a placeholder key via `define` — not an env file, because the owner's device tooling refuses writes to `.env.*` and the values aren't secrets. `src/demo/install.ts` patches `window.fetch` and answers PostgREST reads/writes (filters, embeds), RPCs, auth, storage and edge functions from `fixtures.ts`. State is snapshotted to `sessionStorage` (`printair.demo.tables`) so it survives the reloads that paying and role-switching cause; the chosen role is `printair.demo.role`. The yellow Demo control (edge tab on phones, pill on desktop) switches visitor / customer / partner / designer / admin and resets data.

When you add a feature that calls a new table, RPC or function, **teach the demo backend about it** or the owner's click-through breaks. The known-good script: as customer open project `p1` → choose a provider → Pay now → simulate payment → switch to partner → "Cup Sleeves" is in Active Projects.

## 10. Working on the owner's machine

The owner is non-technical, works from the Claude desktop app on Windows, and reviews by double-clicking `Start PrintAir Demo.bat` and clicking around. Explain things in plain language; show screenshots.

- The real repo is `D:\All Apps\printair-pwa` (git, branch `main`, `node_modules` installed, `.env` and `.env.production` present and git-ignored). Latest commit at handoff: see `git log` — the last one described here is "Pre-launch pass…", followed by the commit that added this file.
- Earlier sessions built in a cloud sandbox and synced files down; the sandbox copy is disposable and its commit hashes differ. **The device repo is the source of truth.**
- Git on that mount sometimes leaves `.git/index.lock` behind: `rm -f .git/index.lock` before and after `git add` / `git commit`. Delete permission for `D:\All Apps` had to be requested once per session.
- The file bridge re-encodes PNGs in transit (different bytes, identical pixels) — not corruption.
- Commit identity used so far: `user.name=Claude`, `user.email=noreply@anthropic.com`, messages ending with the `Co-Authored-By: Claude …` and `Claude-Session: …` trailer lines of the current session.
- Windows line endings: git warns "LF will be replaced by CRLF"; harmless. The `.bat` must stay CRLF.
- `pkill -f "vite …"` inside a compound shell command kills its own shell (exit 144). Kill by port instead (`fuser -k 4180/tcp`).
- A Claude project named **"Printair"** holds cross-session docs: `pwa/00-decisions.md` (decisions + status — keep it current), `pwa/01-feature-inventory.md`, `pwa/03-backend-followups.md`, `pwa/04-agent-handoff.md` (copy of this file), and `pwa/02-base44-prompts.md` (superseded).

### How changes were verified (repeat this)

1. `npm run check`.
2. Playwright against `vite preview` (4175) with route mocks: a 45-screen screenshot pass over all roles at phone and desktop widths, failing on any `pageerror` / console error.
3. Playwright against demo mode (4180): the click-through in §9.
4. For PWA changes: manifest parses, service worker activates, offline reload works, **zero Supabase responses in any cache**.
5. Lighthouse on the production build.
6. Look at the screenshots yourself before telling the owner it works.

The harness scripts lived in a session scratchpad and are not in the repo. Worth adding as `e2e/` with `playwright-core` as a dev dependency if you have the time — it is the single most useful missing piece of tooling.

## 11. State at handoff

Done: full redesign of every screen for all four roles with parity audited against the original (automated API-usage comparison plus an independent review, findings fixed); PWA layer; demo mode; owner's logo; story rail with arrows; always-visible install; pre-launch pass (code splitting, contrast, share card, robots.txt, legal drafts, honest inspiration section, assistant `inert` when closed).

**Not deployed yet.** No GitHub remote yet.

### Open — needs the owner

1. **Legal.** Fill `src/data/legal.ts` (registered name, address, contact email, platform-fee refund rule — deliberately blank, it is a business decision), have `/privacy` and `/terms` reviewed by someone qualified in Philippine law, set `reviewed: true`. Until then both pages show "Draft" and the build warns. The drafts were written from what the code does; do not add policy the owner hasn't decided.
2. **Checkout return.** `create-booking-checkout` builds PayMongo's return link from the `SITE_URL` secret, so someone paying from the PWA lands on the *website's* `/checkout/return`. Payment still settles by webhook. Either serve the PWA at `SITE_URL`, or apply the allowlisted `return_origin` change in `docs/BACKEND-FOLLOWUPS.md` (in the website repo).
3. **Inspiration cards.** `INSPIRATION_ITEMS` are stock Pexels photos with sample quotes inherited from the website. Shown as "Ideas to start from" with quotes and places hidden (`STORIES_ARE_REAL = false` in `LandingPage.tsx`). Only flip it when real jobs, with permission, replace the data. Photos are still hot-linked (the build sandbox couldn't download them); self-hosting them in `public/` is a small, worthwhile follow-up.
4. **Deploy.** Create a GitHub repo and push; deploy to Cloudflare Pages / Netlify / Vercel (configs included) over HTTPS with the env vars in §4; add `https://<app-address>/reset-password` to Supabase → Authentication → URL Configuration. Edge-function CORS is already `*`.
5. **Real-device pass** after go-live: install, sign up, post a project, pay — on one Android phone and one iPhone. Everything so far was tested in emulated devices only.

### Open — engineering backlog

- Error monitoring and privacy-friendly analytics (none today; the privacy page says "no advertising trackers" — keep that true or update it).
- Gaps inherited from the original: designer "My proposals" list, customer profile editing, partner logo / portfolio / avatars, portfolio captions, print-review names in admin, in-app notifications and web push (phase 2; on iOS push works only for installed apps).
- Optional: wrap for Google Play as a Trusted Web Activity. The App Store would need a native wrapper.
- Commit the Playwright harness (§10).

## 12. Things that already went wrong (so you don't repeat them)

| Symptom | Cause | Fix in place |
|---|---|---|
| Blank page, then "Failed to fetch dynamically imported module …/DemoSwitcher.tsx" | `optimizeDeps.exclude: ['lucide-react']` + ad blocker | `include` instead; boot screen shows startup errors |
| Demo opened a stale or wrong app | default port reused, old service worker | port 4180 strict; demo unregisters service workers |
| `npm install` crashes on npm 10 | peer-dependency resolution | `.npmrc` `legacy-peer-deps=true`, plugin-react ^6, TS ~5.9 |
| `dimensions.test.ts` fails "Missing Supabase config" | client module reads env at import | test env in `vitest.config.ts` |
| Page stays scroll-locked after closing stacked sheets | per-sheet body lock | module-level counter in `Sheet` |
| Dates off by one | `new Date('2026-09-19')` parsed as UTC | `formatDate` parses date-only values as local |
| Install option invisible on localhost | it only rendered after `beforeinstallprompt`, which never fires without a service worker | always-visible "Get the app" + steps sheet |
| Story cards clipped with no way to scroll on desktop | swipe-only rail, hidden scrollbar, snap ignoring padding | `Rail` component |
| Faint orange wordmark / pink buttons failed contrast | logo orange 2.5:1 on paper, `magenta-500` 3.9:1 | deeper orange on light, accent → `magenta-600` |

## 13. How the owner likes to work

Short, plain-language updates; screenshots over descriptions; decisive recommendations ("go" means do all of it). Ask only when a decision is truly theirs (legal facts, business rules, real vs sample content, where things are hosted). When a default is needed to keep moving, pick the honest, reversible one, say so in one line, and record it in `pwa/00-decisions.md`.
