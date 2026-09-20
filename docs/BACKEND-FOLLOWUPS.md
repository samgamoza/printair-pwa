# Backend follow-ups

Nothing in the backend was changed to build this app. These are the changes worth making there, in the website repo (`printair_claude`), now that a second front end exists. None is required for the app to run.

## 1. Return customers to the front end they paid from

**Problem.** `supabase/functions/create-booking-checkout/index.ts` builds PayMongo's `successUrl` / `cancelUrl` (and the mock checkout URL) from the `SITE_URL` secret. With two front ends, someone paying from the app is returned to the website.

**Change (edge function).** Accept an optional `return_origin` and use it only if it is on an allowlist:

```ts
// after reading { order_id, kind } from the request body
const allowed = (Deno.env.get("ALLOWED_RETURN_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const requested = typeof body.return_origin === "string" ? body.return_origin : null;
const siteUrl = requested && allowed.includes(requested) ? requested : Deno.env.get("SITE_URL");
```

Then set the secret, comma-separated, no trailing slashes:

```bash
npx supabase secrets set ALLOWED_RETURN_ORIGINS="https://printair.ph,https://app.printair.ph"
```

The allowlist matters: without it, anyone could make PayMongo send a paying customer to a look-alike site.

**Change (both front ends).** In `src/lib/api/payments.ts`, add `return_origin: window.location.origin` to the body of both `create-booking-checkout` calls. Until the function is updated the extra field is ignored, so this is safe to ship first.

## 2. Email links

`supabase/functions/send-notifications/index.ts` links every email to `SITE_URL`. That is fine: the website and the app show the same data. If you later want emails to open the app, point `SITE_URL` at the app's address (and apply follow-up 1 so website users still return to the website after paying).

## 3. Show names on print reviews in the admin console

`listReviews()` in `src/lib/api/admin.ts` selects `*` only, so the admin Reviews page cannot name the partner or project a review is about (Design Reviews can, because `listDesignReviews()` joins them). Matching it is a one-line change to the select:

```ts
.select('*, partner:partner_profiles(business_name), project:projects(title)', { count: 'exact' })
```

## 4. Gaps in the original that are still open

Carried over as they were, because closing them needs product decisions or backend work:

- Designers have no "My proposals" list (partners have My Quotations). `getDesignerProposals()` already exists.
- Customers have no screen to edit their own name, mobile or city. `updateMyProfile()` already exists.
- Partner logo, partner portfolio images and profile avatars have database columns but no upload UI and no storage bucket.
- Portfolio uploads accept a caption in the API (`uploadPortfolioItem(id, file, caption)`), but the designer profile screen has never asked for one.
- The decline dialog on an opportunity says "you can still change your mind and quote later", but once declined the page hides the quote form.
- There is no in-app notification inbox; notifications are email only. Web push would be the natural next step for the installed app (needs VAPID keys, a subscriptions table and a change to `send-notifications`).

## 5. The "delight" features: what the front end does today, and what the backend would add

Added 2026-09-20 in `src/delight/`. Everything below works now without any backend change. Each one has a bigger version that does need the backend; none of it has been built, and none of it should be until the owner picks a front end (see `supabase/README.md`).

| Feature | What works today (front end only) | What the backend would add |
| --- | --- | --- |
| **Suki status** | A badge and progress bar from the customer's count of delivered projects. Recognition only; it promises no perks. | Real perks (a lower platform fee, priority matching) are business rules. They need an owner decision first, then a server-side rule in `create-booking-checkout` so the fee cannot be edited from the browser. |
| **Invite a ka-negosyo** | Shares the app's address through the phone's share sheet. | Referral rewards need a `referrals` table (who invited whom), a code on sign-up, and a rule for when the reward is earned (first delivered order, not sign-up, or it will be farmed). |
| **Ask someone's opinion** | Shares a plain-text summary of the quotes (partner, price, days) to any chat app. | A private read-only link where a business partner can view and vote needs a `project_shares` table with an unguessable token and an RLS policy for it. |
| **Order progress ("Pip is printing…")** | Restates the order's real status as a friendly sentence and a four-step bar. | A photo from the printer at each step needs an `order_event_photos` column or table, a storage bucket and an upload control on the partner's status screen. |
| **Your budget** | One labelled line at the end of the project's notes ("Target budget: ₱5,000. …"), which partners already read. | A real `budget` column on `projects` would let partners filter opportunities by it and let the assistant suggest what fits. |
| **Preview on a product** | Draws the customer's image on a simple cup, box or bag, on the device. Captioned as not a print proof. | True-to-size mockups per catalog item need templates per product and, ideally, server-side rendering. |
| **Show it off** | Builds a Stories-sized picture on the device and hands it to the share sheet. | If customers may opt in to a public gallery, that needs a consent flag, a moderation queue and a public read policy. This is also how the sample "Ideas to start from" become real stories. |
| **Top-rated printing partners** | Top three from the existing public directory, shown only when partners have real reviews. | Nothing needed. A monthly "partner of the month" would need a small view over reviews by month. |
| **Season kits** | Fixed dates and cautious lead times in `src/delight/seasons.ts`. | Lead times should come from real partner turnaround once there is order history. |
| **Sounds, confetti, Taglish, dark mode** | Saved on the device only (`localStorage`, key `printair.prefs`). | Nothing needed. Saving them to the profile would make them follow the person across devices. |

Web push ("You have a new quote") is still the single most valuable missing piece for an installed app; it is described at the end of section 4.
