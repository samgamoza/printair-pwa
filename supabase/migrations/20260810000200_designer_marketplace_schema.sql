/*
  PrintAir — designer marketplace, core schema.

  Adds freelance graphic designers as a first-class role, vetted for
  print-ready output, so a customer without artwork can commission one
  without leaving PrintAir. See docs/FEATURE-PLAN-DESIGNER-MARKETPLACE.md
  for the decisions this schema builds to — do not re-litigate them here.

  Deliberately a parallel structure, not a merge into the print-marketplace
  tables: a print partner sells manufacturing capacity, a designer sells
  creative time, and the fields differ enough (design needs revision rounds
  and file versioning; print needs quantity/material/delivery city) that one
  schema covering both would bloat both with nullable fields that don't apply.

  Shape, deliberately parallel to projects -> opportunities -> quotes -> orders:
    customer -> design_request -> design_opportunities (one per matching designer)
             -> design_proposals (one active per designer per request)
             -> selected proposal -> design_order -> design_deliverables (revisions)
             -> design_order_status_events -> design_review

  Everything here is deny-by-default; policies live in the RLS migration
  (20260810000400_designer_marketplace_rls.sql).
*/

-- ---------------------------------------------------------------------------
-- 1. Role: profiles.role widened to include 'designer'
--
-- The CHECK was written inline in CREATE TABLE, so it has an auto-generated
-- name. Looked up dynamically rather than assumed, matching the approach
-- 20260807000100_booking_payments.sql used for orders.status.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT tc.constraint_name INTO v_conname
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'profiles'
    AND tc.constraint_type = 'CHECK'
    AND ccu.column_name = 'role';

  IF v_conname IS NULL THEN
    RAISE EXCEPTION 'Could not find the existing CHECK constraint on profiles.role — schema has drifted from what this migration expects.';
  END IF;

  EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_conname);
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('customer', 'partner', 'designer', 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Reference data — design specialties
--
-- A separate table from print_categories on purpose (decision #1): design
-- specialties are not print product categories. Deliberately narrow (decision
-- #2) — print-adjacent design that feeds a print job, not a general
-- freelance-design marketplace. Do not add hourly-work or non-print
-- categories here without revisiting that decision.
-- ---------------------------------------------------------------------------

CREATE TABLE design_specialties (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  tagline     text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0
);

INSERT INTO design_specialties (id, name, tagline, sort_order) VALUES
  ('logo',              'Logo Design',       'A mark and wordmark your printed materials can build around.', 1),
  ('label',             'Label Design',      'Product and packaging labels, sized and bled for print.',       2),
  ('packaging',         'Packaging & Box',   'Dieline-aware box, carton, and pouch design.',                   3),
  ('product-graphics',  'Product Graphics',  'Print-ready graphics for an existing product line.',             4);

-- ---------------------------------------------------------------------------
-- 3. Designer identity
-- ---------------------------------------------------------------------------

CREATE TABLE designer_profiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE RESTRICT,
  display_name             text NOT NULL CHECK (length(btrim(display_name)) > 0),
  city                     text NOT NULL CHECK (length(btrim(city)) > 0),
  bio                      text,
  application_note         text,
  -- Optional at signup, completed later — same pattern as partner_profiles.
  typical_turnaround_days  int CHECK (typical_turnaround_days IS NULL OR typical_turnaround_days > 0),
  rate_min                 numeric(12,2) CHECK (rate_min IS NULL OR rate_min > 0),
  rate_max                 numeric(12,2) CHECK (rate_max IS NULL OR rate_max > 0),
  avatar_url               text,
  -- pending_review -> active (approved) or rejected, by admin_review_designer().
  -- active <-> suspended afterwards, same shape partner_profiles.status already
  -- has. Every designer gets a human approval click before going live
  -- (decision #4) — there is no automated path into 'active'.
  status                   text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
                             'pending_review', 'active', 'rejected', 'suspended')),
  reviewed_by              uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at              timestamptz,
  review_reason            text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (rate_min IS NULL OR rate_max IS NULL OR rate_max >= rate_min)
);

CREATE INDEX idx_designer_profiles_status ON designer_profiles (status);

-- Which specialties this designer wants opportunities for. Matching key,
-- mirrors partner_capabilities exactly.
CREATE TABLE designer_specialties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id  uuid NOT NULL REFERENCES designer_profiles(id) ON DELETE CASCADE,
  specialty    text NOT NULL REFERENCES design_specialties(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_id, specialty)
);

CREATE INDEX idx_designer_specialties_specialty ON designer_specialties (specialty);

/*
  Portfolio samples as real rows with format/dimension metadata, not a bare
  text[] of URLs (unlike partner_profiles.portfolio_images) — the automated
  review flags (decision #4 / section 5 of the plan) need something to check.
  width_px/height_px are read client-side at upload via the browser Image
  API; there is no server-side image processing here, matching the plan's
  explicit "basic width/height check, not full DPI/color-profile parsing".
*/
CREATE TABLE designer_portfolio_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id   uuid NOT NULL REFERENCES designer_profiles(id) ON DELETE CASCADE,
  storage_path  text NOT NULL UNIQUE,
  file_name     text NOT NULL,
  mime_type     text,
  width_px      int CHECK (width_px IS NULL OR width_px > 0),
  height_px     int CHECK (height_px IS NULL OR height_px > 0),
  caption       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_designer_portfolio_items_designer ON designer_portfolio_items (designer_id);

-- ---------------------------------------------------------------------------
-- 4. Design requests — the customer's job posting
-- ---------------------------------------------------------------------------

CREATE TABLE design_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title                 text NOT NULL CHECK (length(btrim(title)) > 0),
  specialty             text NOT NULL REFERENCES design_specialties(id),
  description           text,
  budget_min            numeric(12,2) CHECK (budget_min IS NULL OR budget_min > 0),
  budget_max            numeric(12,2) CHECK (budget_max IS NULL OR budget_max > 0),
  target_date           date,
  notes                 text,
  status                text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                          'DRAFT', 'OPEN_FOR_PROPOSALS', 'DESIGNER_SELECTED',
                          'IN_PROGRESS', 'DELIVERED', 'CANCELLED')),
  selected_proposal_id  uuid,  -- FK added after design_proposals exists
  submitted_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min)
);

CREATE INDEX idx_design_requests_customer ON design_requests (customer_id, status);
CREATE INDEX idx_design_requests_specialty_status ON design_requests (specialty, status);

-- Reference images at request time. Unlike project_files (one file per
-- project), a design brief commonly needs several references, so this is a
-- plain one-to-many table rather than a UNIQUE-per-request row.
CREATE TABLE design_request_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES design_requests(id) ON DELETE CASCADE,
  storage_path  text NOT NULL UNIQUE,
  file_name     text NOT NULL,
  mime_type     text,
  size_bytes    bigint CHECK (size_bytes IS NULL OR size_bytes > 0),
  uploaded_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_request_files_request ON design_request_files (request_id);

-- ---------------------------------------------------------------------------
-- 5. Opportunity distribution — mirrors opportunities exactly
-- ---------------------------------------------------------------------------

CREATE TABLE design_opportunities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES design_requests(id) ON DELETE CASCADE,
  designer_id  uuid NOT NULL REFERENCES designer_profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'VIEWED', 'PROPOSED', 'DECLINED')),
  question     text,
  answer       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, designer_id)
);

CREATE INDEX idx_design_opportunities_designer ON design_opportunities (designer_id, status);

-- ---------------------------------------------------------------------------
-- 6. Proposals — mirrors quotes, with a revision-rounds field quotes has no
--    equivalent of.
-- ---------------------------------------------------------------------------

CREATE TABLE design_proposals (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id               uuid NOT NULL REFERENCES design_requests(id) ON DELETE CASCADE,
  designer_id              uuid NOT NULL REFERENCES designer_profiles(id) ON DELETE CASCADE,
  price                    numeric(12,2) CHECK (price IS NULL OR price > 0),
  down_payment_pct         numeric(5,2)  CHECK (down_payment_pct IS NULL OR (down_payment_pct >= 0 AND down_payment_pct <= 100)),
  turnaround_days          int           CHECK (turnaround_days IS NULL OR turnaround_days > 0),
  -- How many revision rounds are included at this price. Per-proposal rather
  -- than a platform-wide constant (unlike booking_fee_pct()) because the plan
  -- leaves the revision-limit policy deliberately open; the designer states
  -- it, more can be negotiated via `note`. Not enforced as a hard cap in v1 —
  -- see submit_design_deliverable() in the functions migration.
  revision_rounds_included int NOT NULL DEFAULT 2 CHECK (revision_rounds_included >= 0),
  note                     text,
  valid_until              date,
  status                   text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                             'DRAFT', 'SUBMITTED', 'WITHDRAWN', 'SELECTED', 'NOT_SELECTED')),
  submitted_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- A submitted proposal must be complete. Drafts may be partially filled.
  CONSTRAINT design_proposals_submitted_is_complete CHECK (
    status = 'DRAFT' OR (
      price IS NOT NULL AND
      down_payment_pct IS NOT NULL AND
      turnaround_days IS NOT NULL
    )
  )
);

-- One *active* proposal per designer per request — same shape as
-- idx_quotes_one_active_per_partner.
CREATE UNIQUE INDEX idx_design_proposals_one_active_per_designer
  ON design_proposals (request_id, designer_id)
  WHERE status IN ('DRAFT', 'SUBMITTED', 'SELECTED');

CREATE INDEX idx_design_proposals_request ON design_proposals (request_id, status);
CREATE INDEX idx_design_proposals_designer ON design_proposals (designer_id, status);

ALTER TABLE design_requests
  ADD CONSTRAINT design_requests_selected_proposal_fk
  FOREIGN KEY (selected_proposal_id) REFERENCES design_proposals(id) ON DELETE SET NULL;

-- At most one selected proposal per request.
CREATE UNIQUE INDEX idx_design_proposals_one_selected_per_request
  ON design_proposals (request_id) WHERE status = 'SELECTED';

-- ---------------------------------------------------------------------------
-- 7. Orders — mirrors orders, opening AWAITING_PAYMENT directly (the
--    print side only reached this shape after 20260807000100_booking_payments;
--    the designer side is built after that pattern was already proven, so it
--    starts there rather than repeating the CONFIRMED-first history).
--    No READY stage: a design deliverable has no physical pickup step.
-- ---------------------------------------------------------------------------

CREATE TABLE design_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL UNIQUE REFERENCES design_requests(id) ON DELETE RESTRICT,
  proposal_id   uuid NOT NULL UNIQUE REFERENCES design_proposals(id) ON DELETE RESTRICT,
  customer_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  designer_id   uuid NOT NULL REFERENCES designer_profiles(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'AWAITING_PAYMENT' CHECK (status IN (
                  'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED')),
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_orders_designer ON design_orders (designer_id, status);
CREATE INDEX idx_design_orders_customer ON design_orders (customer_id, status);

CREATE TABLE design_order_status_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES design_orders(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED')),
  note        text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_order_events_order ON design_order_status_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- 8. Deliverables — the genuinely new piece (decision #6). No print-side
--    equivalent: print artwork is one file, no revisions; design work needs
--    iteration rounds.
-- ---------------------------------------------------------------------------

CREATE TABLE design_deliverables (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES design_orders(id) ON DELETE CASCADE,
  revision_number    int NOT NULL CHECK (revision_number >= 1),
  storage_path       text NOT NULL UNIQUE,
  file_name          text NOT NULL,
  mime_type          text,
  size_bytes         bigint CHECK (size_bytes IS NULL OR size_bytes > 0),
  uploaded_by        uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  customer_feedback  text,
  approved           boolean NOT NULL DEFAULT false,
  approved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, revision_number)
);

CREATE INDEX idx_design_deliverables_order ON design_deliverables (order_id, revision_number);

-- ---------------------------------------------------------------------------
-- 9. Payments — mirrors booking_payments exactly. Reuses the same PayMongo
--    Edge Function infrastructure and the same 5%-of-price mechanic
--    (decision #5); the Edge Functions are updated in a later build step to
--    branch on which table they are settling, not duplicated.
-- ---------------------------------------------------------------------------

CREATE TABLE design_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL UNIQUE REFERENCES design_orders(id) ON DELETE RESTRICT,
  amount                numeric(12,2) NOT NULL CHECK (amount > 0),
  currency              text NOT NULL DEFAULT 'PHP',
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  provider              text NOT NULL DEFAULT 'paymongo',
  provider_checkout_id  text,
  provider_payment_id   text,
  paid_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_payments_provider_checkout ON design_payments (provider_checkout_id);

-- ---------------------------------------------------------------------------
-- 10. Reviews — mirrors reviews exactly.
-- ---------------------------------------------------------------------------

CREATE TABLE design_reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL UNIQUE REFERENCES design_orders(id) ON DELETE CASCADE,
  request_id        uuid NOT NULL REFERENCES design_requests(id) ON DELETE RESTRICT,
  customer_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  designer_id       uuid NOT NULL REFERENCES designer_profiles(id) ON DELETE RESTRICT,
  rating            int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           text,
  would_work_again  boolean NOT NULL,
  hidden            boolean NOT NULL DEFAULT false,
  hidden_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_design_reviews_designer ON design_reviews (designer_id) WHERE hidden = false;
CREATE INDEX idx_design_reviews_customer ON design_reviews (customer_id);

-- ---------------------------------------------------------------------------
-- 11. updated_at maintenance — reuses set_updated_at() from the core schema.
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_designer_profiles_updated BEFORE UPDATE ON designer_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_design_requests_updated   BEFORE UPDATE ON design_requests   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_design_opportunities_updated BEFORE UPDATE ON design_opportunities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_design_proposals_updated  BEFORE UPDATE ON design_proposals  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_design_orders_updated     BEFORE UPDATE ON design_orders     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_design_payments_updated   BEFORE UPDATE ON design_payments   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
