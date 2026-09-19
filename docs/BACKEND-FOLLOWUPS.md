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
