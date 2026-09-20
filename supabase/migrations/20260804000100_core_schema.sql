/*
  PrintAir marketplace — core schema.

  Replaces the previous single-tenant lead-capture model (project_leads /
  provider_applications), which could not express a marketplace: it had no
  users, no per-provider isolation, and no quote/order/review loop.

  Shape of the marketplace:
    customer -> project -> opportunities (one per matching partner)
             -> quotes (one active per partner per project)
             -> selected quote -> order -> status events -> review

  Everything here is deny-by-default; policies live in the RLS migration.
*/

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

-- Print categories double as the provider-matching key. Keeping them in a table
-- (rather than a CHECK list) gives real FK integrity and one place to extend.
CREATE TABLE print_categories (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  tagline     text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0
);

INSERT INTO print_categories (id, name, tagline, sort_order) VALUES
  ('product',   'Product Packaging',      'Boxes and cartons that make your product stand out on the shelf.', 1),
  ('food',      'Food Packaging',         'Safe, food-grade packaging for takeout and ready-to-eat.',         2),
  ('coffee',    'Coffee Shop',            'Cups, sleeves, pastry boxes, menus, labels, bags, and signage.',   3),
  ('bakery',    'Bakery or Cake Business','Cake boxes, pastry trays, labels, bags, and gift packaging.',      4),
  ('beauty',    'Beauty and Skincare',    'Premium boxes, labels, and sleeves for cosmetics and skincare.',   5),
  ('retail',    'Retail',                 'Shopping bags, hang tags, signage, and shelf-ready packaging.',    6),
  ('marketing', 'Marketing Materials',    'Flyers, brochures, posters, and standees that get attention.',     7),
  ('labels',    'Labels and Stickers',    'Die-cut stickers, roll labels, and product labels in any shape.',  8),
  ('corporate', 'Corporate and Events',   'Business cards, invitations, event kits, and conference materials.',9);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('customer', 'partner', 'admin')),
  full_name   text NOT NULL CHECK (length(btrim(full_name)) > 0),
  email       text NOT NULL,
  mobile      text,
  city        text,
  avatar_url  text,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON profiles (role);

CREATE TABLE partner_profiles (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  business_name            text NOT NULL CHECK (length(btrim(business_name)) > 0),
  contact_name             text NOT NULL CHECK (length(btrim(contact_name)) > 0),
  city                     text NOT NULL CHECK (length(btrim(city)) > 0),
  description              text,
  -- Everything below is optional at signup and completed later in the dashboard.
  typical_turnaround_days  int CHECK (typical_turnaround_days IS NULL OR typical_turnaround_days > 0),
  service_areas            text[] NOT NULL DEFAULT '{}',
  services                 text[] NOT NULL DEFAULT '{}',
  logo_url                 text,
  portfolio_images         text[] NOT NULL DEFAULT '{}',
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Which categories this partner wants opportunities for. This is the matching key.
CREATE TABLE partner_capabilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  category    text NOT NULL REFERENCES print_categories(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, category)
);

CREATE INDEX idx_partner_capabilities_category ON partner_capabilities (category);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             text NOT NULL CHECK (length(btrim(title)) > 0),
  category          text NOT NULL REFERENCES print_categories(id),
  description       text,
  -- Technical fields are nullable because every one of them supports
  -- "I'm not sure" / "Recommend for me", stored as those sentinel strings.
  quantity          int CHECK (quantity IS NULL OR quantity > 0),
  quantity_note     text,
  size_spec         text,
  material_pref     text,
  finishing_pref    text,
  target_date       date,
  delivery_city     text,
  notes             text,
  status            text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                      'DRAFT', 'OPEN_FOR_QUOTES', 'PROVIDER_SELECTED',
                      'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED')),
  selected_quote_id uuid,  -- FK added after quotes exists
  submitted_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_customer ON projects (customer_id, status);
CREATE INDEX idx_projects_category_status ON projects (category, status);

-- One primary artwork/reference file per project for MVP.
CREATE TABLE project_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  storage_path  text NOT NULL UNIQUE,
  file_name     text NOT NULL,
  mime_type     text,
  size_bytes    bigint CHECK (size_bytes IS NULL OR size_bytes > 0),
  uploaded_by   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Opportunity distribution
-- ---------------------------------------------------------------------------

-- One row per (project, matching partner). No ranking, no scoring, no privilege:
-- every matching partner gets an identical record.
CREATE TABLE opportunities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  partner_id   uuid NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'VIEWED', 'QUOTED', 'DECLINED')),
  question     text,          -- optional single clarification question
  answer       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, partner_id)
);

CREATE INDEX idx_opportunities_partner ON opportunities (partner_id, status);

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------

CREATE TABLE quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  partner_id            uuid NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  total_price           numeric(12,2) CHECK (total_price IS NULL OR total_price > 0),
  down_payment_pct      numeric(5,2)  CHECK (down_payment_pct IS NULL OR (down_payment_pct >= 0 AND down_payment_pct <= 100)),
  turnaround_days       int           CHECK (turnaround_days IS NULL OR turnaround_days > 0),
  estimated_completion  date,
  delivery_available    boolean NOT NULL DEFAULT false,
  note                  text,
  valid_until           date,
  status                text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
                          'DRAFT', 'SUBMITTED', 'WITHDRAWN', 'SELECTED', 'NOT_SELECTED')),
  submitted_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- A submitted quote must be complete. Drafts may be partially filled.
  CONSTRAINT quotes_submitted_is_complete CHECK (
    status = 'DRAFT' OR (
      total_price IS NOT NULL AND
      down_payment_pct IS NOT NULL AND
      turnaround_days IS NOT NULL
    )
  )
);

-- One *active* quotation per provider per project. A withdrawn or not-selected
-- quote is history and does not block a resubmission.
CREATE UNIQUE INDEX idx_quotes_one_active_per_partner
  ON quotes (project_id, partner_id)
  WHERE status IN ('DRAFT', 'SUBMITTED', 'SELECTED');

CREATE INDEX idx_quotes_project ON quotes (project_id, status);
CREATE INDEX idx_quotes_partner ON quotes (partner_id, status);

ALTER TABLE projects
  ADD CONSTRAINT projects_selected_quote_fk
  FOREIGN KEY (selected_quote_id) REFERENCES quotes(id) ON DELETE SET NULL;

-- At most one selected quotation per project.
CREATE UNIQUE INDEX idx_quotes_one_selected_per_project
  ON quotes (project_id) WHERE status = 'SELECTED';

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  quote_id      uuid NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE RESTRICT,
  customer_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id    uuid NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN (
                  'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED')),
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_partner ON orders (partner_id, status);
CREATE INDEX idx_orders_customer ON orders (customer_id, status);

CREATE TABLE order_status_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED')),
  note        text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_events_order ON order_status_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

CREATE TABLE reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id        uuid NOT NULL REFERENCES partner_profiles(id) ON DELETE CASCADE,
  rating            int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           text,
  would_work_again  boolean NOT NULL,
  hidden            boolean NOT NULL DEFAULT false,
  hidden_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_partner ON reviews (partner_id) WHERE hidden = false;

-- ---------------------------------------------------------------------------
-- Admin audit
-- ---------------------------------------------------------------------------

CREATE TABLE admin_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  target_table  text NOT NULL,
  target_id     uuid,
  reason        text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated         BEFORE UPDATE ON profiles         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_partner_profiles_updated BEFORE UPDATE ON partner_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_projects_updated         BEFORE UPDATE ON projects         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_opportunities_updated    BEFORE UPDATE ON opportunities    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_quotes_updated           BEFORE UPDATE ON quotes           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated           BEFORE UPDATE ON orders           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
