# PrintAir — Designer Marketplace Feature Plan

**Status:** Planned, not built. Documented for a future build session.
**Date:** 2026-08-07
**Origin:** Chief Engineer + user discussion, same session as the booking-fee payments feature and the PrintAir Assistant LLM upgrade.

---

## 1. The problem

Customers who need print/packaging work often don't have print-ready artwork. Today they either already have their own designer, or hope a printing partner helps — but a printing partner's job is production capacity, not creative work, so relying on them for design is slow and not really their core competency.

## 2. The idea

Add freelance graphic designers as a first-class part of the platform, specifically **vetted for print-ready output** (correct color mode, bleed, resolution, dielines — not just "has a nice portfolio"). A customer can commission a designer directly, then flow the finished artwork straight into a print project without leaving PrintAir.

## 3. Decisions already locked in (do not re-litigate — build to these)

1. **Designers are a separate role** (`customer` / `partner` / `designer` / `admin`), not a category inside `partner_profiles`. A print partner sells manufacturing capacity; a designer sells creative time — different business model, different profile shape. Mixing them would clutter the partner directory customers browse for actual printing.
2. **v1 scope is narrow**: print-adjacent design only (logos, labels, packaging/box design, product graphics) that feeds directly into a print project — **not** a general freelance-design marketplace. Don't build hourly billing, arbitrary design categories, or anything that isn't in service of "this becomes a print job."
3. **Dedicated subdomain**: `design.guma.one`. This should point to a **dedicated route/experience inside the existing PrintAir codebase and Supabase project** — not a separate app/repo/deploy pipeline. Same auth, same job data, just a different front door with designer-specific branding and onboarding copy. Add a Cloudflare Tunnel ingress rule for it (same pattern used for `printair.guma.one` — see `docs/CHIEF-ENGINEER-REVIEW-SUMMARY.md` history / the tunnel `guma_one`, `d70b9881-07f3-4287-9f29-5fd4c76bd3ee`, currently routes via dashboard-managed Routes, not the stale local `config.yml` in CT 106).
4. **Vetting model: hybrid, human-gated.** Automated checks **flag and prioritize** applications (missing/too-few portfolio samples, obviously wrong file formats, low-resolution raster uploads) — they do **not** auto-reject. Every designer still gets an actual human approval click before going live. This is what lets PrintAir honestly claim "vetted by print professionals" for every approved designer; the flags just make the reviewer's job faster by surfacing likely problems first. True CMYK/bleed/dieline correctness needs real print expertise, not code — don't try to build deep color-profile analysis for v1.
5. **Payment**: reuse the exact PayMongo Edge Function infrastructure already built for the print marketplace's platform fee (`supabase/functions/create-booking-checkout`, `paymongo-webhook`, `_shared/paymongo.ts`). Same 5%-of-price-to-PrintAir mechanic unless a business reason emerges to differ for design work.
6. **Revisions are a real, new capability.** The current print-artwork flow is one file, no revisions. Design work needs iteration rounds — this is the single biggest net-new piece of engineering here, not just "another marketplace loop."
7. **The integration payoff**: once a design deliverable is approved, a button creates a new print project **pre-filled with that artwork file** — no re-upload, no leaving the platform. This is the actual "expedite" value the whole feature is for; don't ship the designer marketplace without this last step, or it's just a separate product bolted on.

## 4. Schema plan (parallel to the print marketplace's proven pattern, not merged into it)

Mirrors `projects → opportunities → quotes → orders` — same shape, same reasoning (SECURITY DEFINER RPCs for every state change, RLS deny-by-default, forward-only status via an `*_stage_rank()` function), just for design work:

| New table | Mirrors | Notes |
|---|---|---|
| `designer_profiles` | `partner_profiles` | Portfolio, specialties (logo/packaging/label/etc.), rate range, turnaround. `status`: `pending_review → approved / rejected`, then `active / suspended` after approval — same state-machine shape `partner_profiles.status` already has, just with the extra pre-approval gate in front. |
| `design_requests` | `projects` | Customer's job posting: description, specialty needed, reference images, budget range. |
| `design_opportunities` | `opportunities` | Matched designers notified by specialty, same fan-out pattern as `distribute_opportunities()`. |
| `design_proposals` | `quotes` | Designer's bid: price, turnaround, note. |
| `design_orders` | `orders` | Opens `AWAITING_PAYMENT` same as print orders; same webhook-only confirm-to-`CONFIRMED` pattern. |
| `design_deliverables` | *(new — no print-side equivalent)* | File uploads per revision round: `revision_number`, `uploaded_by`, `customer_feedback`, `approved boolean`. This is where the real new work is. |
| `design_payments` | `booking_payments` | Same shape, same Edge Function flow. |
| `design_reviews` | `reviews` | Same shape as the existing reviews table. |

Keep these genuinely parallel (separate tables), not polymorphic/merged with the print-side tables — the fields differ enough (design needs revision rounds and file versioning; print needs quantity/material/delivery city) that forcing one schema to cover both would bloat both with nullable fields that don't apply to the other.

## 5. Automated flag criteria (lightweight — v1 scope)

- Portfolio sample count below a minimum (e.g., fewer than 3).
- Obviously wrong file formats for print-ready claims (accept PDF/AI/EPS/high-res JPG/PNG; flag anything else).
- Low-resolution raster uploads relative to any claimed print dimensions (basic width/height check, not full DPI/color-profile parsing).

These become prompts in the reviewer's queue ("⚠️ 2 samples below expected resolution"), not auto-decisions.

## 6. New frontend surfaces (three, not one)

1. **`design.guma.one`** — designer application/onboarding + job board (browsing/responding to `design_opportunities`).
2. **Client-facing "commission a designer" flow** — likely reachable from the main `printair.guma.one` app (a customer without artwork should be routed here naturally, e.g. from the Project Builder's "I don't have artwork yet" path).
3. **Admin review queue** — new page alongside the existing `AdminProvidersPage`/moderation views, for approving/rejecting pending designer applications with the automated flags surfaced.

## 7. Suggested build order (when this gets picked up)

1. Schema migration: `designer` role, all new tables + RLS + RPCs, mirroring the print-marketplace migration style already established (see `supabase/migrations/20260804*.sql` and `20260807000100_booking_payments.sql` for the pattern and header-comment conventions to follow).
2. Admin review queue (needed before anything can go live end-to-end, since designers can't receive jobs until approved).
3. Designer onboarding/application flow at `design.guma.one` (new Cloudflare Tunnel ingress rule once the route exists, same process used for `printair.guma.one`).
4. Design request → proposal → order loop (client + designer sides).
5. Deliverables + revisions (the genuinely new piece).
6. Payment wiring (should be fast — mostly reusing existing Edge Functions).
7. The "start a print project from this design" handoff button — the actual point of the whole feature.

Rough sizing: comparable to the booking-fee payments feature built in this same session, likely larger given it's a whole new role with three distinct new frontend surfaces rather than one payment flow bolted onto an existing page.

---

*This document is a plan, not a spec frozen in stone — revisit assumptions (especially the automated-flag criteria and revision-limit policy, which was intentionally left open) before building.*
