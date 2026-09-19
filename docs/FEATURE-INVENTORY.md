# PrintAir PWA — Feature Inventory and Parity Checklist

Source of truth: the website repo (`printair_claude/landing`) at commit `acd1751`. This is the checklist the PWA is tested against: every box describes something the original does that this app must also do.

The redesign changes how things look and how you move between them. It does not change what a screen can do, which fields it collects, which statuses exist, or who is allowed to do what. Those rules live in Supabase (row-level security and `SECURITY DEFINER` RPCs) and the PWA reuses the original `src/lib/api/*` layer untouched.

## 1. Roles and routing

Four roles: `customer`, `partner` (print shop), `designer`, `admin`. Account status is `active` or `suspended`. Designers have an extra gate: `pending_review` → `active` / `rejected` / `suspended`, and only `active` designers receive work.

| Route | Who | Screen |
|---|---|---|
| `/` | public | Landing (on a `design.*` hostname this shows the designer landing instead) |
| `/design` | public | Designer landing / recruitment pitch |
| `/partners`, `/partners/:id` | public | Partner directory, partner public profile |
| `/designers`, `/designers/:id` | public | Designer directory, designer public profile |
| `/reset-password` | public (from email link) | Choose a new password |
| `/checkout/mock/:orderId` | signed in | Stand-in checkout (mock PayMongo mode only) |
| `/checkout/return` | signed in | Payment confirmation / polling |
| `/dashboard` | customer | My Projects |
| `/dashboard/projects/:id` | customer | Project detail |
| `/dashboard/designs` | customer | My Designs |
| `/dashboard/designs/:id` | customer | Design request detail |
| `/partner` + `opportunities`, `opportunities/:id`, `quotes`, `projects`, `completed`, `profile`, `settings` | partner | Partner workspace |
| `/designer` + `opportunities`, `opportunities/:id`, `orders`, `profile` | designer | Designer workspace |
| `/admin` + `providers`, `designers`, `projects`, `quotes`, `reviews`, `design-reviews` | admin | Admin console |
| `*` | public | Falls back to landing |

New in the PWA only: `/app` (sends a signed-in user to their role's home, otherwise opens sign-in) and `/offline`. The four customer routes now sit under one `CustomerLayout`, which owns the + button and both create flows.

- [ ] `ProtectedRoute` behaviour kept: signed-out visitors are sent to `/` with the sign-in modal open, a wrong-role user is redirected to their own home, and a suspended account sees a full-screen "This account has been suspended" message.
- [ ] After sign-in, users land on their role home: customer `/dashboard`, partner `/partner`, designer `/designer`, admin `/admin`.

## 2. Authentication (one modal, eleven steps)

- [ ] Email-first entry: "Log in or sign up" asks for email only, then `email_exists` decides between password entry and account creation.
- [ ] Password step, with a "forgot password" path.
- [ ] Customer sign-up: first name, last name, password (min 8, strength check), optional PH mobile (validated, e.g. 0917 123 4567).
- [ ] Partner sign-up, two steps: account (contact name, password) then business (business name, city, mobile, print categories served as multi-select chips, optional services).
- [ ] Designer sign-up, two steps: account (display name, password) then profile (city, mobile, specialties multi-select, bio, application note). Copy makes clear this is an application reviewed by a person.
- [ ] Reset request → "reset link sent" confirmation → `/reset-password` page with new + confirm password → success state.
- [ ] Friendly sign-up error messages (`describeSignupError`).
- [ ] "Stay put" behaviour: a visitor who signs up mid-Project-Builder stays in the builder and does not get bounced to the dashboard. Fresh customers otherwise land on `/dashboard?new=1`, which opens the builder.
- [ ] Account menu: signed-out shows "Log in or sign up", "Join as a Printing Partner", Help; signed-in shows the role's dashboard link, Help, Sign out.

## 3. Customer — print projects

### Project Builder (guided wizard)

Steps: category → recommended item → packaging/material → quantity → timeline → details → done. Progress bar across the first six. Back button on every step except the first and last.

- [ ] Category step: 9 business categories (Product Packaging, Food Packaging, Coffee Shop, Bakery or Cake Business, Beauty and Skincare, Retail, Marketing Materials, Labels and Stickers, Corporate and Events) plus two special flows: "Bring Your Own Sample" and "I Already Know What I Need". Special flows skip straight to details.
- [ ] Recommend step: "PrintAir recommends" list of 4–6 items for the category.
- [ ] Packaging step: material options filtered per item (Kraft, Art Card, Corrugated, Paper Labels, Vinyl, Textured), each with description and blurb.
- [ ] Quantity step: 100–500 / 500–2,000 / 2,000–10,000 / 10,000+, each with a hint.
- [ ] Timeline step: ASAP/Rush, 2–3 weeks, Flexible, Just exploring.
- [ ] Details step, signed out: sign-in prompt in place (stay-put).
- [ ] Details step, signed in: a DRAFT project is created immediately (guarded against double-creation), then fields: description (required), exact quantity (optional), size/dimensions, finishing preference, target date, delivery city (required, pre-filled from profile), notes, one artwork file.
- [ ] Structured dimensions: per item shape — box (Length × Width × Height), bag (Width × Height × Gusset), flat (Width × Height) — with unit switch in / cm / mm, stored canonically; bespoke items keep a free-text size field.
- [ ] "I'm not sure" toggle on size and finishing (stores the `unsure` sentinel; placeholder becomes "We will recommend this for you").
- [ ] Artwork upload: one file, .pdf .jpg .jpeg .png .ai .zip, max 25 MB, inline validation error, "Don't have artwork yet?" hint pointing at the design marketplace.
- [ ] Two actions: "Save & continue later" (keeps DRAFT, goes to My Projects) and "Send to printing partners" (validates, uploads, `submit_project`).
- [ ] Done step: celebration, start another, close.
- [ ] Builder can be opened pre-set to a category (from landing cards and from the assistant).

### My Projects (`/dashboard`)

- [ ] Filter tabs: All, Draft, Open for Quotes, Active, Completed.
- [ ] Project cards: title, category, status badge, a "next action" line (e.g. "Compare 3 quotations", "Ready — arrange delivery or pickup", "Leave a review"), live count of submitted quotes on open projects.
- [ ] "New project" button opens the builder; empty state with the same call to action; `?new=1` auto-opens it.
- [ ] Shell navigation: My Projects, My Designs.

### Project detail (`/dashboard/projects/:id`)

- [ ] Loading, not-found/no-access, and action-error banner states.
- [ ] Summary card with all fields and artwork download (signed URL). Inline edit mode while DRAFT (description, quantity, target date, size, material, finishing, delivery city, notes).
- [ ] DRAFT actions: "Send to printing partners", "Delete draft". OPEN_FOR_QUOTES action: "Cancel project". Both destructive actions need confirmation.
- [ ] Clarification Q&A: questions from partners listed with the asking shop's name; customer can answer each once.
- [ ] Quote comparison (while open): per quote — partner name (links to public profile), city, total price ₱, down payment %, turnaround days, estimated completion, delivery available / pickup only, note, "Choose this provider" with confirmation. Empty state: "We're looking for the right printing partner."
- [ ] After choosing: order is created at AWAITING_PAYMENT. Platform fee card (5% of quote, amount comes from the database) with "Pay now" → `create-booking-checkout` → redirect. Failed/expired attempt shows a retry message.
- [ ] Order timeline: AWAITING_PAYMENT → CONFIRMED → IN_PRODUCTION → READY → DELIVERED, with timestamped events and partner notes.
- [ ] Selected provider card (price, down payment, turnaround).
- [ ] After DELIVERED: review form (1–5 stars, comment, "Would you work with them again?" yes/no), then the submitted review is shown. Quotation history list.

Project statuses: DRAFT, OPEN_FOR_QUOTES, PROVIDER_SELECTED, IN_PROGRESS, READY, DELIVERED, CANCELLED.
Quote statuses: DRAFT, SUBMITTED ("Awaiting decision"), WITHDRAWN, SELECTED, NOT_SELECTED.

## 4. Customer — design marketplace

- [ ] My Designs list with filters All, Draft, Open for Proposals, Active, Completed; next-action line; proposal counts; empty state.
- [ ] Design Request Builder (single form): title, specialty (Logo Design, Label Design, Packaging & Box, Product Graphics), description, budget from/to ₱, target date, multiple reference files (.pdf .jpg .jpeg .png .webp .zip, 25 MB each, removable), notes. One action, "Post to designers": it creates the draft, uploads the files, then submits; if that fails the draft is removed so no orphan is left. (Drafts that show in the list come from an interrupted flow; they can be submitted or deleted from the detail page.)
- [ ] Request detail: summary with inline edit while DRAFT, reference file downloads, submit / delete draft / cancel with confirmation.
- [ ] Clarification Q&A from designers, same pattern as print.
- [ ] Proposal comparison: designer name (links to profile), city, price ₱, down payment %, turnaround days, revision rounds included, valid until, note, "Choose this designer" with confirmation.
- [ ] Platform fee card and checkout, same as print (`kind: 'design'`).
- [ ] Design order timeline: AWAITING_PAYMENT → CONFIRMED → IN_PROGRESS → DELIVERED.
- [ ] Deliverables card: revisions newest-first, download each, approved marker, previous feedback quoted. On the latest unapproved revision: feedback box, "Approve", "Request a revision" (feedback required).
- [ ] "Ready to print" handoff: on an approved deliverable, pick a print category and the app creates a print project draft with that file already attached, then opens it.
- [ ] Selected designer card, proposal history, design review form after delivery.

Design request statuses: DRAFT, OPEN_FOR_PROPOSALS, DESIGNER_SELECTED, IN_PROGRESS, DELIVERED, CANCELLED.
Proposal statuses: DRAFT, SUBMITTED, WITHDRAWN, SELECTED, NOT_SELECTED.

## 5. Partner (print shop) workspace

- [ ] Navigation with live badges: Home, New Opportunities (count of NEW), My Quotations, Active Projects (count needing an update), Completed Projects, Business Profile, Settings.
- [ ] "Complete your business profile" banner until description, turnaround, categories and service areas are filled.
- [ ] Home: "What should I work on next?" with four count cards (New opportunities, Quotations awaiting decision, Projects ready for a status update, Active projects) and recent reviews.
- [ ] New Opportunities list: matched projects with status badge NEW / VIEWED / QUOTED / DECLINED; empty state.
- [ ] Opportunity detail: auto-marks VIEWED; full project brief; note that artwork unlocks once selected; decline (with confirmation); ask **one** clarification question and see the customer's reply or "waiting"; quote form.
- [ ] Quote form: total price ₱, down payment %, turnaround days, estimated completion, valid until, delivery available toggle, note. Save draft, submit, edit while SUBMITTED, withdraw (confirmation). Read-only state when SELECTED / NOT_SELECTED / WITHDRAWN. Note: "Payment happens outside PrintAir."
- [ ] My Quotations: all quotes with project title, category, price, status.
- [ ] Active Projects: each order with timeline; one button advancing to the next stage (Confirmed → In Production → Ready → Delivered) with an optional note; AWAITING_PAYMENT shows a waiting message and no button.
- [ ] Completed Projects: delivered date and the review earned, or "No review left yet."
- [ ] Business Profile: business name, contact person, city, typical turnaround, description, service areas, services/capabilities, print categories served (drives matching). Validation on save.
- [ ] Settings: account email, "Send password reset link", sign out.

## 6. Designer workspace

- [ ] Navigation with badges: Home, Job Board, My Orders, My Profile.
- [ ] Status banner for pending_review, rejected (with reason), suspended.
- [ ] Home, approved: job board and portfolio cards with counts. Home, not approved: checklist (add portfolio samples, fill in rates and turnaround).
- [ ] Job Board: locked message until approved; matched requests with specialty, budget range label, NEW marker; empty state.
- [ ] Opportunity detail: auto-mark viewed; brief with budget, target date, notes, downloadable reference files; decline; one clarification question; proposal form.
- [ ] Proposal form: price ₱, down payment %, turnaround days, revision rounds included (default 2), valid until, note; draft / submit / edit / withdraw; read-only end states. Note: "Payment happens through PrintAir."
- [ ] My Orders: active and completed; timeline; upload a revision while CONFIRMED or IN_PROGRESS (.pdf .jpg .jpeg .png .ai .eps .zip, 50 MB); revision list with downloads; latest customer feedback; "waiting for the customer to review"; waiting-for-payment message; review earned on delivered orders.
- [ ] My Profile: portfolio grid (upload JPG/PNG/WebP/PDF up to 10 MB with caption, delete), display name, city, bio, specialties (drives matching), typical turnaround, rate from/to ₱.

## 7. Admin console

All lists are paged at 25 with a pager, loading state, and an error state with "Try again".

- [ ] Users: name, email, role, status; Suspend / Reinstate, reason required.
- [ ] Providers: business, contact, city, status (read-only; suspension is done from Users).
- [ ] Designer applications: queue oldest-first; expandable card with applicant details, application note, specialties, portfolio images, automated flags that guide but never decide; reason text field; Approve / Reject.
- [ ] Projects: title, category, customer, status.
- [ ] Quotes: project, partner, price, turnaround, status, submitted date.
- [ ] Reviews and Design Reviews: rating, comment, hidden state; Hide / Restore, reason required.

## 8. Public pages

- [ ] Landing: navbar (How it works, Project Builder, Inspiration, Partners, Join as a Printing Partner, designer link), hero, marquee, how it works, builder preview with category cards, inspiration stories, partners, provider recruitment, footer.
- [ ] Designer landing (`/design`): pitch and "apply as a designer" entry.
- [ ] Partner directory and public profile: description, categories, services, completed projects, typical turnaround, service areas, rating and reviews.
- [ ] Designer directory and public profile: specialties, completed commissions, typical turnaround, typical rate, portfolio, reviews. Only `active` designers ever appear.

## 9. AI assistant

- [ ] Floating chat button with pulse and unread dot, greeting, four quick prompts.
- [ ] Replies come from the `chat-assistant` edge function, with a built-in keyword fallback if it fails.
- [ ] Replies can carry a call-to-action button that opens the Project Builder on a specific category, or opens the partner application.
- [ ] Proactive nudges tied to the landing section being viewed.

## 10. Payments

- [ ] `create-booking-checkout` returns a checkout URL; real PayMongo in production, `/checkout/mock/:orderId` when `PAYMONGO_MOCK=true` (buttons to simulate paid / failed).
- [ ] `/checkout/return` polls the payment row: confirming → "Platform fee received" → back to the project/request; failed/expired → "No charge was made, try again"; unknown session → error.
- [ ] The job price itself is never collected by the app for print; only the platform fee is.

## 11. Things that exist only on the backend

Email notifications are sent by the `send-notifications` edge function on a schedule for twelve event kinds (opportunity received, quote received, quote selected, order status changed, payment confirmed, and the seven designer-marketplace equivalents). There is **no in-app notification inbox** in the original, so the PWA does not get one in v1. Push notifications are a phase-2 item.

## 12. Gaps found in the original while taking inventory

- **Closed in the PWA:** selected partners can now download the customer's artwork (Active Projects). The database already allowed it; only the screen was missing.
- **Closed in the PWA:** admin suspend/reinstate and review moderation used the browser's `prompt()`; they now use reason sheets. Same RPCs, reason still required.
- **Still open** (listed with suggested fixes in `BACKEND-FOLLOWUPS.md`): no designer "My proposals" list, no customer profile editing, unused logo / portfolio-image / avatar columns, no caption input on portfolio uploads, print reviews in admin cannot name the partner.

## 13. Cross-cutting behaviour to preserve

- [ ] Every screen has loading, empty and error states; failed fetches never spin forever.
- [ ] All amounts in Philippine pesos via `formatPHP`; dates in `en-PH` short format.
- [ ] Browser `confirm()` / `prompt()` dialogs are replaced by designed confirmation sheets in the PWA, but each one still exists and the reason field is still required where it was.
- [ ] File downloads use 10-minute signed URLs; portfolio images are public URLs.
- [ ] Client-side validation in `src/lib/validation.ts` and `src/lib/dimensions.ts` is reused as-is, along with their unit tests.
