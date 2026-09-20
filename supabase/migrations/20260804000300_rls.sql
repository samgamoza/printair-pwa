/*
  PrintAir — row level security.

  Deny by default on every table. The UI hides things it shouldn't show, but
  nothing here depends on that: an unselected provider calling the REST API
  directly with a valid token still cannot read the customer's artwork, the
  order, or a competitor's quotation.
*/

ALTER TABLE print_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table privileges.
--
-- RLS decides *which rows*; grants decide *which verbs*. Both are needed, and
-- being explicit here keeps the migration portable to any Postgres rather than
-- depending on Supabase's default-privilege setup.
-- ---------------------------------------------------------------------------

GRANT SELECT                         ON print_categories     TO anon, authenticated;
GRANT SELECT, UPDATE                 ON profiles             TO authenticated;
GRANT SELECT                         ON partner_profiles     TO anon;
GRANT SELECT, UPDATE                 ON partner_profiles     TO authenticated;
GRANT SELECT                         ON partner_capabilities TO anon;
GRANT SELECT, INSERT, DELETE         ON partner_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects             TO authenticated;
GRANT SELECT, INSERT, DELETE         ON project_files        TO authenticated;
GRANT SELECT, UPDATE                 ON opportunities        TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON quotes               TO authenticated;
GRANT SELECT                         ON orders               TO authenticated;
GRANT SELECT                         ON order_status_events  TO authenticated;
GRANT SELECT                         ON reviews              TO anon, authenticated;
GRANT SELECT                         ON admin_audit_log      TO authenticated;

-- Deliberately never granted to clients: INSERT/UPDATE on orders,
-- order_status_events, and reviews. Those move only through the RPCs.

-- ---------------------------------------------------------------------------
-- Policy predicates.
--
-- These exist because the access rules are genuinely circular: a partner may
-- read a project because an opportunity points at it, and may read that
-- opportunity because of the project it points at. Expressed as inline
-- subqueries, Postgres re-enters each policy from inside the other and aborts
-- with "infinite recursion detected in policy".
--
-- SECURITY DEFINER breaks the cycle: the lookup inside runs as the function
-- owner with RLS skipped, so evaluating one policy never re-triggers another.
-- Each one answers a single yes/no question and leaks no rows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owns_project(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND customer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_editable_project(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND customer_id = auth.uid()
      AND status IN ('DRAFT', 'OPEN_FOR_QUOTES')
  );
$$;

-- True when the calling partner was sent an opportunity for this project.
CREATE OR REPLACE FUNCTION public.partner_has_opportunity(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM opportunities
    WHERE project_id = p_project_id AND partner_id = public.my_partner_id()
  );
$$;

-- True only for the partner who actually won the project.
CREATE OR REPLACE FUNCTION public.partner_has_order(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders
    WHERE project_id = p_project_id AND partner_id = public.my_partner_id()
  );
$$;

-- True when this partner may still put a quotation on this project.
CREATE OR REPLACE FUNCTION public.can_quote_on(p_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM opportunities o
    JOIN projects p ON p.id = o.project_id
    WHERE o.project_id = p_project_id
      AND o.partner_id = public.my_partner_id()
      AND p.status = 'OPEN_FOR_QUOTES'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_order(p_order_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id
      AND (customer_id = auth.uid() OR partner_id = public.my_partner_id())
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference data — public
-- ---------------------------------------------------------------------------

CREATE POLICY categories_readable ON print_categories
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE POLICY profiles_select_self ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Role and status are never self-service. Enforced in a trigger because RLS
-- alone cannot express "you may update this row but not these columns".
/*
  These guards run as SECURITY INVOKER on purpose. Inside a SECURITY DEFINER
  RPC owned by postgres, current_user is 'postgres', so the guard steps aside
  and the RPC's own validation governs. A direct client UPDATE arrives as
  'authenticated' and the guard applies. Making the guard SECURITY DEFINER
  would report 'postgres' in both cases and disable it entirely.
*/
CREATE OR REPLACE FUNCTION public.guard_profile_privileges() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' OR is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Account type cannot be changed.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Account status cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- partner_profiles — the public directory, plus self-service editing
-- ---------------------------------------------------------------------------

CREATE POLICY partner_profiles_public_read ON partner_profiles
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR user_id = auth.uid() OR is_admin());

CREATE POLICY partner_profiles_update_own ON partner_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_partner_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NOT is_admin() AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Business status cannot be changed.';
  END IF;
  IF NOT is_admin() AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Business owner cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_partner_status
  BEFORE UPDATE ON partner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_partner_status();

-- ---------------------------------------------------------------------------
-- partner_capabilities — public to read, owner-only to change.
-- No provider may touch another provider's matching categories.
-- ---------------------------------------------------------------------------

CREATE POLICY capabilities_public_read ON partner_capabilities
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY capabilities_insert_own ON partner_capabilities
  FOR INSERT TO authenticated WITH CHECK (partner_id = my_partner_id());

CREATE POLICY capabilities_delete_own ON partner_capabilities
  FOR DELETE TO authenticated USING (partner_id = my_partner_id());

-- ---------------------------------------------------------------------------
-- projects
--
-- A partner sees a project only through an opportunity addressed to them, and
-- only while it is genuinely open to them. Once someone else is selected, the
-- losing partners keep no access.
-- ---------------------------------------------------------------------------

CREATE POLICY projects_select ON projects
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR is_admin()
    OR partner_has_opportunity(id)
  );

CREATE POLICY projects_insert_own ON projects
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND my_role() = 'customer');

-- Editable by the owner only before a provider is selected.
CREATE POLICY projects_update_own ON projects
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status IN ('DRAFT', 'OPEN_FOR_QUOTES'))
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY projects_delete_draft ON projects
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid() AND status = 'DRAFT');

-- Customers must not hand-edit status or the selected quote; those move only
-- through the RPCs, which run as SECURITY DEFINER and bypass this trigger's
-- caller checks by design.
CREATE OR REPLACE FUNCTION public.guard_project_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Project status changes through PrintAir actions, not direct edits.';
  END IF;
  IF NEW.selected_quote_id IS DISTINCT FROM OLD.selected_quote_id THEN
    RAISE EXCEPTION 'The selected quotation cannot be changed directly.';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'Project ownership cannot be transferred.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_project_status
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_status();

-- ---------------------------------------------------------------------------
-- project_files — private artwork.
--
-- The rule that matters: an unselected provider can never read this row, and
-- therefore never learns the storage path.
-- ---------------------------------------------------------------------------

CREATE POLICY project_files_select ON project_files
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR is_admin()
    OR partner_has_order(project_id)
  );

CREATE POLICY project_files_insert_own ON project_files
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND owns_project(project_id));

CREATE POLICY project_files_delete_own ON project_files
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND owns_editable_project(project_id));

-- ---------------------------------------------------------------------------
-- opportunities — a partner sees only their own; never a competitor's response.
-- ---------------------------------------------------------------------------

CREATE POLICY opportunities_select ON opportunities
  FOR SELECT TO authenticated
  USING (
    partner_id = my_partner_id()
    OR is_admin()
    OR owns_project(project_id)
  );

CREATE POLICY opportunities_update_own ON opportunities
  FOR UPDATE TO authenticated
  USING (partner_id = my_partner_id()) WITH CHECK (partner_id = my_partner_id());

-- The customer may answer a clarification question on their own project.
CREATE POLICY opportunities_answer ON opportunities
  FOR UPDATE TO authenticated
  USING (owns_project(project_id)) WITH CHECK (owns_project(project_id));

-- ---------------------------------------------------------------------------
-- quotes
--
-- Two separate readers with different rules:
--   the authoring partner sees their own quote at any status, including drafts;
--   the customer sees only quotes that were actually submitted to them.
-- A partner can never see another partner's quotation at all.
-- ---------------------------------------------------------------------------

CREATE POLICY quotes_select_own_partner ON quotes
  FOR SELECT TO authenticated USING (partner_id = my_partner_id() OR is_admin());

CREATE POLICY quotes_select_customer ON quotes
  FOR SELECT TO authenticated
  USING (
    status IN ('SUBMITTED', 'SELECTED', 'NOT_SELECTED')
    AND owns_project(project_id)
  );

CREATE POLICY quotes_insert_own ON quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    partner_id = my_partner_id()
    AND status = 'DRAFT'
    AND can_quote_on(project_id)
  );

-- Editable by its author until the customer selects a provider.
CREATE POLICY quotes_update_own ON quotes
  FOR UPDATE TO authenticated
  USING (partner_id = my_partner_id() AND status IN ('DRAFT', 'SUBMITTED'))
  WITH CHECK (partner_id = my_partner_id());

CREATE OR REPLACE FUNCTION public.guard_quote_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Quotation status changes through PrintAir actions, not direct edits.';
  END IF;
  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'A quotation cannot be moved to another project or partner.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_quote_status
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION public.guard_quote_status();

-- ---------------------------------------------------------------------------
-- orders — only the two parties involved, plus admin.
-- Writes happen exclusively through update_order_status().
-- ---------------------------------------------------------------------------

CREATE POLICY orders_select ON orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR partner_id = my_partner_id() OR is_admin());

CREATE POLICY order_events_select ON order_status_events
  FOR SELECT TO authenticated
  USING (can_read_order(order_id) OR is_admin());

-- ---------------------------------------------------------------------------
-- reviews — public once written, unless an admin has hidden them.
-- Providers can read but never edit or delete.
-- ---------------------------------------------------------------------------

CREATE POLICY reviews_public_read ON reviews
  FOR SELECT TO anon, authenticated
  USING (hidden = false OR customer_id = auth.uid() OR is_admin());

-- ---------------------------------------------------------------------------
-- admin audit log
-- ---------------------------------------------------------------------------

CREATE POLICY audit_admin_only ON admin_audit_log
  FOR SELECT TO authenticated USING (is_admin());

-- ---------------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION
  public.submit_project(uuid),
  public.cancel_project(uuid),
  public.submit_quote(uuid),
  public.withdraw_quote(uuid),
  public.select_quote(uuid),
  public.update_order_status(uuid, text, text),
  public.create_review(uuid, int, text, boolean),
  public.admin_set_account_status(uuid, text, text),
  public.admin_moderate_review(uuid, boolean, text)
TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private artwork bucket.
--
-- Object paths are `<project_id>/<filename>`, so access is decided by looking
-- up that project. Same rule as project_files: owner always, selected partner
-- after selection, unselected partners never.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artwork', 'artwork', false, 26214400,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/postscript',                    -- .ai
    'application/illustrator',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'                   -- some browsers send .ai/.zip as this
  ]
)
ON CONFLICT (id) DO NOTHING;

-- split_part(name,'/',1) is the project id. It is only ever compared against
-- rows the caller is already allowed to see, via the same predicates the
-- project_files policies use.
CREATE POLICY artwork_customer_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'artwork'
    AND public.owns_project(nullif(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY artwork_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'artwork'
    AND (
      public.owns_project(nullif(split_part(name, '/', 1), '')::uuid)
      OR public.partner_has_order(nullif(split_part(name, '/', 1), '')::uuid)
      OR public.is_admin()
    )
  );

CREATE POLICY artwork_customer_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'artwork'
    AND public.owns_editable_project(nullif(split_part(name, '/', 1), '')::uuid)
  );
