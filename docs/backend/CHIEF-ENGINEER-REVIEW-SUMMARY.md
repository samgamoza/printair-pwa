# PrintAir — Chief Engineer Review Summary

**Date:** 2026-08-06 (remediation pass same day — see §6 update below)
**Repo:** `D:\All Apps\Printair` — single app `landing/` (renamed from `bolt-landing/` on 2026-08-06; Vite + React 18 + TypeScript + React Router 6 + Supabase + Tailwind)
**Branch:** `main` (5 commits; latest `26e455a` at time of original review — remediation work is uncommitted, see status below)
**Scope reviewed:** full schema/RLS/RPC layer (3 migrations, 1324 SQL lines), full frontend + data-access layer (pages, components, `lib/api/*`), build/test/tooling/deploy hygiene

---

## 0. Remediation status (2026-08-06, same-day follow-up)

All Phase 0–4 items below were implemented and verified against a real local Supabase instance (`npx supabase db reset` + `npm test`, 47/47 passing, including 3 new security regression tests). Nothing is committed yet — review the diff and commit when ready.

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Critical (F1, F2) | ✅ Fixed | New migration `20260806000100_critical_security_patch.sql`; `scripts/seed.mjs` updated to match; regression tests added to `tests/marketplace.test.ts` |
| 1 — High DB hardening (F3, F4, F9, F15, F16) | ✅ Fixed | New migration `20260806000200_hardening.sql` |
| 2 — Engineering foundation (F5, F6, F7, F14, F22) | ✅ Fixed | `README.md`, `.github/workflows/ci.yml`, `netlify.toml`, `package.json` name, `PASTE-CHECKLIST.md` renamed to `_SCRATCH-PASTE-CHECKLIST.md` |
| 3 — Frontend robustness (F10, F11, F12, F18, F19 partial) | ✅ Fixed | Shared `useAdminList`/`AdminPager`, error handling on all list pages, `listQuotes` join, `validateBusinessProfile()`, one `as never` cast replaced with an honest `as ProjectStatus` |
| 4 — Housekeeping (F13, F20, F24, F26) | ✅ Fixed | 11 unused images deleted, `ResetPasswordPage` keys off the URL recovery token + `PASSWORD_RECOVERY` event, `noUnusedLocals`/`noUnusedParameters` enabled (no violations found), `og:image`/`og:url`/canonical added |

**Deliberately not changed** (flagged for a product decision, not fixed unilaterally):
- **F17 (`Assistant.tsx`)** — it's a scripted keyword-matching widget labeled "Your AI printing guide," matching the site's "AI Printing Partner" positioning. Whether to disclose it's scripted or wire a real LLM is a product/brand call, not a bug — left as-is.
- **F19 (remaining `as unknown as` casts)** — `admin.ts`, `opportunities.ts`, `orders.ts`, `quotes.ts` still cast PostgREST joined-select results. Fixing these properly needs `supabase gen types` run against the live schema; deferred rather than hand-guessed.
- **`og:image`/canonical domain** — set to `printair.ph` for consistency with `admin@printair.ph`/`hello@printair.ph` already in the codebase, but not confirmed as the real production domain. Verify before deploying.
- **Legal entity footer (SEC/TIN placeholder)** — still open; needs real business registration details from the owner, not something to fabricate.

Two things worth knowing before you commit:
1. **`.env` now exists locally** (gitignored, not committed) pointing at the local Supabase instance used for verification — matches what the new README tells any contributor to do themselves.
2. **A local rate limit** (`auth.rate_limit.sign_in_sign_ups = 30` per 5 min per IP, in `supabase/config.toml`, pre-existing and unrelated to this change) will make `npm test` fail with an opaque `{}` error if you re-run the suite several times in quick succession — that's expected local-dev noise, not a bug. Wait a few minutes or restart the `supabase_auth_*` container if you hit it.

---

---

## 1. One-line verdict

**Functionally a strong MVP — real RLS-backed multi-role marketplace with a genuine end-to-end test suite — but it ships with two critical DB-layer vulnerabilities (admin self-escalation via signup, and an IDOR on `opportunities`) that must be patched before any real signup traffic, plus no CI, no README, and no deploy config.** Everything else found is normal pre-launch hardening, not a redesign.

---

## 2. What the product is

A print-services marketplace: customers post print projects → matching print-provider "partners" get opportunities and submit quotes → customer selects a quote → project becomes an order with a tracked status timeline → completed orders get reviews. Three roles: `customer`, `partner`, `admin`, enforced via Supabase `profiles.role` + Postgres RLS. Public marketing landing page + partner directory are unauthenticated.

---

## 3. Findings

Ordered by severity. Each cites exact file:line and a concrete fix — this is what a fix PR should address, not prose to re-interpret.

### 🔴 CRITICAL — patch before any real signups

**F1 — Public signup can self-assign `role='admin'` → full platform takeover.**
`supabase/migrations/20260804000200_functions.sql` — `handle_new_user()` (~L84, L89) reads `role` directly from client-controlled `raw_user_meta_data` and only validates it's one of `('customer','partner','admin')`. Any caller of `supabase.auth.signUp({ options: { data: { role: 'admin' } } } })` gets `profiles.role = 'admin'`, which satisfies `is_admin()` everywhere — every admin RLS policy and both admin RPCs (`admin_set_account_status`, `admin_moderate_review`).
**Fix:** restrict self-service `v_role` to `('customer','partner')` only in `handle_new_user()`; provision admins exclusively via `service_role` (as `scripts/seed.mjs` already does) or a dedicated `admin_promote_user()` RPC gated by an existing admin.
**Action:** if this app has *any* real signups today (not just seed data), audit `profiles WHERE role = 'admin'` immediately for unexpected rows before deploying the fix.

**F2 — `opportunities` table has no identity-guard trigger → IDOR.**
`supabase/migrations/20260804000300_rls.sql` (~L303-310). Unlike every other mutable table (`profiles`, `partner_profiles`, `projects`, `quotes` all have `guard_*` triggers), `opportunities_update_own` and `opportunities_answer` have no `WITH CHECK` restricting `project_id`/`partner_id`/`status`. A partner can `PATCH` their own opportunity row's `project_id` to any project UUID, which then satisfies `partner_has_opportunity()` → grants read access to that project and lets them submit a quote on it, entirely bypassing the intended `distribute_opportunities()` matching logic. A customer can similarly rewrite `status`/`question` on any opportunity tied to their project outside the intended flow.
**Fix:** add a `guard_opportunity_identity()` `BEFORE UPDATE` trigger (mirror `guard_quote_status`) rejecting changes to `project_id`/`partner_id`; scope `status` transitions to the RPC layer or split into column-scoped policies (partner may touch only `question`, customer only `answer`).

### 🟠 HIGH

**F3 — Cascading deletes on `auth.users` destroy the *other* party's business records.**
`core_schema.sql`: `profiles.id → auth.users ON DELETE CASCADE` cascades through `projects`, `partner_profiles`, `opportunities`, `quotes`, `orders`, `order_status_events`, `reviews`. Deleting one user's auth row (GDPR request, admin cleanup) silently deletes completed orders/reviews the *counterparty* has a legitimate interest in keeping — note `order_status_events.created_by` and `admin_audit_log.actor_id` deliberately use `ON DELETE SET NULL`, showing this was handled correctly elsewhere but missed here.
**Fix:** change `orders`/`order_status_events`/`reviews`/`quotes` FKs on `customer_id`/`partner_id` to `ON DELETE RESTRICT`; route account deletion through the existing `status='suspended'` mechanism instead of hard-deleting `auth.users` once an account has transaction history.

**F4 — State-changing RPCs never `REVOKE`d from `PUBLIC`.**
`rls.sql` (~L398-408) grants `EXECUTE` on all state-changing RPCs to `authenticated` but never precedes it with `REVOKE ALL ... FROM PUBLIC` — Postgres grants `EXECUTE` to `PUBLIC` by default at function creation, so `anon` still has grant-level access (only internal `assert_active()`/`is_admin()` checks stop it today). `email_exists` already does this correctly (`REVOKE ALL ... FROM public` before its `GRANT`) — the pattern just wasn't applied consistently.
**Fix:** add `REVOKE ALL ON FUNCTION public.<name>(...) FROM PUBLIC;` before each grant, for all RPCs and helper functions, as defense-in-depth against a future refactor that drops an internal check.

**F5 — No CI pipeline anywhere.** No `.github/workflows/*` in the repo. Nothing runs lint/typecheck/test/build automatically.
**Fix:** add a minimal GitHub Actions workflow running `npm ci && npm run lint && npm run typecheck && npm run build && npm test` — test step needs a local Supabase stack (see F6).

**F6 — Integration tests require a live local Supabase instance; undocumented.** `tests/setup.ts` throws without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set and expects `npx supabase start` to have been run first. `tests/marketplace.test.ts` (344 lines) is a genuine end-to-end RLS suite — real signup, real cross-role visibility checks, real quote/order/review lifecycle — good coverage, but nothing in `package.json` or a README documents the precondition.
**Fix:** add `"test:ci": "supabase start && vitest run && supabase stop"` (or equivalent) and document it.

**F7 — No `README.md` for the app.** `PASTE-CHECKLIST.md` at the repo root is not project documentation — it's a one-off manual-file-migration checklist for pasting this Bolt-generated project's files into an unrelated separate monorepo (references `apps/printair`, `goals.ts`, a `reference/` folder that doesn't exist here). Confirmed via content read; it will confuse any future contributor who mistakes it for setup docs.
**Fix:** write a real `README.md` (env vars from `.env.example`, `supabase start`, dev/test/build/deploy commands); rename or remove `PASTE-CHECKLIST.md` from the repo root.

### 🟡 MEDIUM

**F8 — Customer can edit project spec after opportunities/quotes already exist.** `rls.sql` `projects_update_own` permits edits while `status IN ('DRAFT','OPEN_FOR_QUOTES')`, but partners may have already quoted against the original spec by the time it's `OPEN_FOR_QUOTES` — edits don't invalidate existing quotes.
**Fix:** restrict direct updates to `DRAFT` only, or add an RPC-mediated edit path that invalidates outstanding `SUBMITTED` quotes on spec-relevant field changes.

**F9 — Seed script has no production guard.** `scripts/seed.mjs` (~L25) hardcodes a shared password (`PrintAir!2026`) for every seeded account and runs against whatever env vars are present with no check the target is local/dev.
**Fix:** require the Supabase URL to contain `localhost`/`127.0.0.1`, or gate behind an explicit `--yes-production` flag.

**F10 — Several pages swallow fetch errors as silent empty state or infinite spinners.** `src/pages/admin/AdminUsersPage.tsx`, `AdminReviewsPage.tsx` (no try/catch — a throw leaves `loading` stuck `true` forever); `AdminProvidersPage.tsx`, `AdminProjectsPage.tsx`, `AdminQuotesPage.tsx`, `PartnerDirectoryPage.tsx` (no `.catch`, failures become unhandled rejections showing "0 results"); `PartnerPublicProfilePage.tsx` is worst-case — no `.catch` at all, so a failure spins forever.
**Fix:** standardize try/catch (or `.catch`) + error state across all list-fetch call sites; always clear loading in a `finally`.

**F11 — No pagination on any admin list page.** `lib/api/admin.ts` (`listUsers`, `listProviders`, `listProjects`, `listQuotes`, `listReviews`) all do unbounded `select('*')`. Fine at demo scale, a real perf cliff once the marketplace has thousands of rows.
**Fix:** server-side pagination via `.range()` plus page-size UI, or at minimum "load more" with a hard cap.

**F12 — Admin Quotes page has no identifying context.** `listQuotes` returns bare rows with no join to project/partner (unlike `listProjects`, which joins `customer`) — an admin investigating a dispute can't tell which project or partner a quote belongs to.
**Fix:** join `project:projects(title)` and `partner:partner_profiles(business_name)`, matching the pattern already used in `quotes.ts` for partner-facing queries.

**F13 — 11 unreferenced images in `public/`, ~7.8MB.** Grepped every filename against `src/` — none of `printair-aqua.png`, `printair-b&w.png`, `printair-charm1.png`, `printair-gold.png`, `printair-portrait.png`, `printair-soft.png`, `printair1/2/3.png`, or the two `ChatGPT Image Aug 5, 2026...png` files (2.1MB each) are referenced anywhere. Only `printair-logo.png` and `printair-mark.svg` are actually used. Everything in `public/` ships in every build.
**Fix:** delete the unused files, or move genuine design candidates outside `public/`.

**F14 — No deployment config.** No `vercel.json`, `netlify.toml`, or `_redirects` anywhere in the repo. Client-side routing (`react-router-dom`) with no SPA rewrite rule will 404 on refresh in production.
**Fix:** add `netlify.toml` or `vercel.json` with an SPA catch-all rewrite before this goes to a real host.

### 🟢 LOW

- **F15** — `admin_audit_log` has no secondary indexes on `actor_id`/`target_table`/`target_id` (only PK indexed) — slow admin audit queries at scale.
- **F16** — `reviews.customer_id` has no index (only `partner_id` and the unique `order_id` are indexed) — "my reviews" queries will seq-scan.
- **F17** — `Assistant.tsx` is a fully scripted regex bot labeled "Your AI printing guide" with no disclosure it's not a real LLM — expect support complaints once users hit its ~7 keyword buckets and get nothing.
- **F18** — `validation.ts` doesn't cover the Business Profile form (`BusinessProfilePage.tsx`) — a partner entering e.g. a non-numeric turnaround value gets a raw Postgres error instead of a friendly one.
- **F19** — 1× `as never` cast (`ProjectDetailPage.tsx:194`) and 6× `as unknown as` casts (`admin.ts`, `opportunities.ts`, `orders.ts`, `quotes.ts`) bypass the type checker on PostgREST joined-select results — works today but silences future type mismatches.
- **F20** — `ResetPasswordPage.tsx` treats any active session as a valid recovery session (`getSession()` rather than the `PASSWORD_RECOVERY` auth event) — narrow edge case where an already-logged-in user clicking an old/foreign reset link could silently reset their own current password instead of erroring.
- **F21** — `ProjectBuilder.tsx` `DetailsStep` sets `required` on fields outside a `<form>` element, so the HTML5 validation attribute is dead (actual gating happens correctly via `validateProjectForSubmit`, so this is cosmetic).
- **F22** — `package.json` name is still the unedited Vite scaffold default `"vite-react-typescript-starter"`.
- **F23** — `eslint-plugin-react-hooks` pinned to a `-rc.0` prerelease while everything else is stable.
- **F24** — `tsconfig.app.json`/`tsconfig.node.json` explicitly disable `noUnusedLocals`/`noUnusedParameters`, and ESLint's `tseslint.configs.recommended` (not `strict`) doesn't enforce unused-var rules either — dead code accumulates silently.
- **F25** — No `jsx-a11y` ESLint plugin (public marketing site), no import-order plugin, no Prettier/`format` script.
- **F26** — `index.html` is missing `og:image`/`og:url`/canonical link (viewport, description, twitter:card, favicon are all present and correct).

### ✅ Looks solid — verified, no action needed

- RLS is enabled on every table with real per-row scoping (the `opportunities` gap above is a scoping bug within an enabled table, not a missing-RLS table).
- Every `SECURITY DEFINER` function correctly pins `SET search_path = public` — no privilege-escalation-via-search_path vector.
- RPC-level authorization is real: every state-changing RPC re-checks ownership internally rather than trusting RLS alone (correctly compensating for `SECURITY DEFINER` bypassing RLS).
- Forward-only state machines are DB-enforced for orders (`order_stage_rank`), quotes (`guard_quote_status`), and projects (`guard_project_status`) — clients cannot skip or reverse states.
- Cross-role PII containment is solid — partners cannot read customer email/mobile directly; unselected bidders never see uploaded artwork.
- Money/quantity columns use `numeric`, not float — no precision-loss risk; sane `> 0` constraints throughout.
- `database.types.ts` matches the migrations — no stale/hand-edited drift.
- `scripts/seed.mjs` never logs the service-role key; `.env` is correctly gitignored; no secrets found in client code.
- `tests/marketplace.test.ts` is a genuine end-to-end RLS-backed suite, not illusory coverage — signup, matching, quote isolation, forward-only status, review-once, directory aggregates all verified against real Postgres.
- Accessibility basics are fine — real semantic elements (`button`/`a`/`Link`/`input` with `aria-label`s), no bare `div onClick` pattern found.
- File upload validation (`validateArtworkFile`) checks extension + 25MB cap client-side before upload.
- No open-redirect risk in the password-reset flow (`redirectTo` is hardcoded same-origin).

---

## 4. Recommended remediation plan

### Phase 0 — Critical security patch (do first, blocks everything else)
1. New migration: lock `handle_new_user()` to `role IN ('customer','partner')` only (F1).
2. Same migration: add `guard_opportunity_identity()` trigger + tighten `opportunities_update_own`/`opportunities_answer` (F2).
3. Add regression tests to `tests/marketplace.test.ts`: signup with `role: 'admin'` in metadata does not produce an admin profile; partner cannot retarget `opportunities.project_id`; customer cannot arbitrarily flip opportunity `status`.
4. If any real (non-seed) signups exist already, audit `profiles WHERE role = 'admin'` for unexpected rows before/alongside deploying.

### Phase 1 — High-severity DB hardening
1. `ON DELETE CASCADE` → `RESTRICT` for `orders`/`order_status_events`/`reviews`/`quotes` on `customer_id`/`partner_id` (F3).
2. `REVOKE ALL ... FROM PUBLIC` before every RPC/helper-function grant (F4).
3. Add a local-only guard to `scripts/seed.mjs` (F9).

### Phase 2 — Engineering foundation
1. Write `README.md`; remove/relocate `PASTE-CHECKLIST.md` (F7).
2. Add GitHub Actions CI: lint + typecheck + build + test (with `supabase start` in-workflow) (F5, F6).
3. Add deploy config (`netlify.toml` or `vercel.json`) with SPA rewrite (F14).
4. Fix `package.json` name (F22).

### Phase 3 — Frontend robustness
1. Standardize try/catch + error state across all list-fetch pages (F10).
2. Add pagination to `lib/api/admin.ts` list functions + admin UI (F11).
3. Join project/partner context into `listQuotes` (F12).
4. Add `validateBusinessProfile()` (F18); resolve `as never`/`as unknown as` casts (F19).

### Phase 4 — Housekeeping (do opportunistically, low risk/low urgency)
1. Delete the 11 unreferenced `public/` images (F13).
2. Add missing indexes: `admin_audit_log(actor_id, target_table, target_id)`, `reviews(customer_id)` (F15, F16).
3. Decide on `Assistant.tsx`: disclose it's scripted, or wire a real LLM if "AI printing guide" is meant literally (F17).
4. Fix `ResetPasswordPage` to key off the `PASSWORD_RECOVERY` auth event (F20).
5. `og:image`/`og:url`/canonical (F26); re-enable unused-var checks (F24); consider `jsx-a11y` + Prettier (F25); bump `eslint-plugin-react-hooks` off prerelease once stable (F23).

---

## 5. Verification

```powershell
cd "D:\All Apps\Printair\landing"
npm install
npx supabase start
npm run typecheck
npm run lint
npm test
npm run build
```

Manual check after Phase 0 lands:
1. Sign up a fresh account with `options: { data: { role: 'admin' } }` in the client — confirm the resulting `profiles.role` is `customer`, not `admin`.
2. As a partner, attempt to `PATCH` an owned `opportunities` row's `project_id` to an unrelated project UUID via the Supabase client — confirm it's rejected.

---

*Prepared for engineering review — 2026-08-06.*
