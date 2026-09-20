/*
  PrintAir — designer marketplace, row level security.

  Same posture as the print marketplace: deny by default on every table, and
  nothing depends on the UI hiding things. A designer who was never selected,
  calling the REST API directly with a valid token, still cannot read the
  customer's brief files, the order, a competitor's proposal, or any
  deliverable.

  The one rule specific to this half: a designer whose application is still
  pending_review (or was rejected) is inert. They can read and edit their own
  application, and nothing else — no opportunities, no proposals. That is what
  makes "vetted by print professionals" true for every designer a customer can
  actually reach.
*/

ALTER TABLE design_specialties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_specialties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE designer_portfolio_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_request_files        ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_opportunities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_proposals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_order_status_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_deliverables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE design_reviews              ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Table privileges. RLS decides which rows; grants decide which verbs.
-- ---------------------------------------------------------------------------

GRANT SELECT                         ON design_specialties         TO anon, authenticated;
GRANT SELECT                         ON designer_profiles          TO anon;
GRANT SELECT, UPDATE                 ON designer_profiles          TO authenticated;
GRANT SELECT                         ON designer_specialties       TO anon;
GRANT SELECT, INSERT, DELETE         ON designer_specialties       TO authenticated;
GRANT SELECT                         ON designer_portfolio_items   TO anon;
GRANT SELECT, INSERT, DELETE         ON designer_portfolio_items   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON design_requests            TO authenticated;
GRANT SELECT, INSERT, DELETE         ON design_request_files       TO authenticated;
GRANT SELECT, UPDATE                 ON design_opportunities       TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON design_proposals           TO authenticated;
GRANT SELECT                         ON design_orders              TO authenticated;
GRANT SELECT                         ON design_order_status_events TO authenticated;
GRANT SELECT                         ON design_deliverables        TO authenticated;
GRANT SELECT                         ON design_payments            TO authenticated;
GRANT SELECT                         ON design_reviews             TO anon, authenticated;

/*
  Deliberately never granted to clients: INSERT/UPDATE on design_orders,
  design_order_status_events, design_deliverables, design_payments, and
  design_reviews. Those move only through the RPCs — and design_payments
  only ever through a service_role Edge Function, so a browser can ask for a
  checkout session but can never mark its own payment paid.
*/

-- ---------------------------------------------------------------------------
-- Policy predicates.
--
-- Same reason these are SECURITY DEFINER as on the print side: the access
-- rules are circular (a designer reads a request because an opportunity
-- points at it, and reads that opportunity because of the request), and
-- inline subqueries make Postgres re-enter each policy from inside the other
-- and abort with "infinite recursion detected in policy".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owns_design_request(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_requests WHERE id = p_request_id AND customer_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_editable_design_request(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_requests
    WHERE id = p_request_id
      AND customer_id = auth.uid()
      AND status IN ('DRAFT', 'OPEN_FOR_PROPOSALS')
  );
$$;

CREATE OR REPLACE FUNCTION public.designer_has_opportunity(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_opportunities
    WHERE request_id = p_request_id AND designer_id = public.my_designer_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.designer_has_order(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_orders
    WHERE request_id = p_request_id AND designer_id = public.my_designer_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_propose_on(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM design_opportunities o
    JOIN design_requests r ON r.id = o.request_id
    WHERE o.request_id = p_request_id
      AND o.designer_id = public.my_designer_id()
      AND r.status = 'OPEN_FOR_PROPOSALS'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_design_order(p_order_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM design_orders
    WHERE id = p_order_id
      AND (customer_id = auth.uid() OR designer_id = public.my_designer_id())
  );
$$;

-- ---------------------------------------------------------------------------
-- Reference data — public
-- ---------------------------------------------------------------------------

CREATE POLICY design_specialties_readable ON design_specialties
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- designer_profiles
--
-- Only approved designers are publicly visible. A pending or rejected
-- applicant can still see and edit their own row (so they can complete the
-- application), and admins see everything for the review queue.
-- ---------------------------------------------------------------------------

CREATE POLICY designer_profiles_public_read ON designer_profiles
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR user_id = auth.uid() OR is_admin());

CREATE POLICY designer_profiles_update_own ON designer_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

/*
  SECURITY INVOKER on purpose, same reasoning as guard_partner_status: inside
  a SECURITY DEFINER RPC current_user is 'postgres' and the guard steps aside;
  a direct client UPDATE arrives as 'authenticated' and is fully checked.

  status is the important one — a designer approving their own application
  would defeat the entire vetting model.
*/
CREATE OR REPLACE FUNCTION public.guard_designer_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NOT is_admin() AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Designer status is set by PrintAir review, not directly.';
  END IF;
  IF NOT is_admin() AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Designer account owner cannot be changed.';
  END IF;
  IF NOT is_admin() AND (
       NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
    OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
  ) THEN
    RAISE EXCEPTION 'Review details cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_designer_status
  BEFORE UPDATE ON designer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_designer_status();

-- ---------------------------------------------------------------------------
-- designer_specialties / designer_portfolio_items — public to read,
-- owner-only to change. No designer may touch another's matching specialties.
-- ---------------------------------------------------------------------------

CREATE POLICY designer_specialties_public_read ON designer_specialties
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY designer_specialties_insert_own ON designer_specialties
  FOR INSERT TO authenticated WITH CHECK (designer_id = my_designer_id());

CREATE POLICY designer_specialties_delete_own ON designer_specialties
  FOR DELETE TO authenticated USING (designer_id = my_designer_id());

CREATE POLICY designer_portfolio_public_read ON designer_portfolio_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM designer_profiles dp WHERE dp.id = designer_id AND dp.status = 'active')
    OR designer_id = my_designer_id()
    OR is_admin()
  );

CREATE POLICY designer_portfolio_insert_own ON designer_portfolio_items
  FOR INSERT TO authenticated WITH CHECK (designer_id = my_designer_id());

CREATE POLICY designer_portfolio_delete_own ON designer_portfolio_items
  FOR DELETE TO authenticated USING (designer_id = my_designer_id());

-- ---------------------------------------------------------------------------
-- design_requests
--
-- A designer sees a request only through an opportunity addressed to them.
-- Once someone else is selected, the losing designers keep no access.
-- ---------------------------------------------------------------------------

CREATE POLICY design_requests_select ON design_requests
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR is_admin()
    OR designer_has_opportunity(id)
  );

CREATE POLICY design_requests_insert_own ON design_requests
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND my_role() = 'customer');

CREATE POLICY design_requests_update_own ON design_requests
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status IN ('DRAFT', 'OPEN_FOR_PROPOSALS'))
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY design_requests_delete_draft ON design_requests
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid() AND status = 'DRAFT');

CREATE OR REPLACE FUNCTION public.guard_design_request_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Request status changes through PrintAir actions, not direct edits.';
  END IF;
  IF NEW.selected_proposal_id IS DISTINCT FROM OLD.selected_proposal_id THEN
    RAISE EXCEPTION 'The selected proposal cannot be changed directly.';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'Request ownership cannot be transferred.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_design_request_status
  BEFORE UPDATE ON design_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_design_request_status();

-- ---------------------------------------------------------------------------
-- design_request_files — the customer's brief.
--
-- Deliberately broader than project_files: every designer holding an
-- opportunity may read the brief, because they cannot price the work without
-- seeing the references. project_files stays narrower (selected partner only)
-- because that is finished artwork, not a brief.
-- ---------------------------------------------------------------------------

CREATE POLICY design_request_files_select ON design_request_files
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR is_admin()
    OR designer_has_opportunity(request_id)
  );

CREATE POLICY design_request_files_insert_own ON design_request_files
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND owns_design_request(request_id));

CREATE POLICY design_request_files_delete_own ON design_request_files
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND owns_editable_design_request(request_id));

-- ---------------------------------------------------------------------------
-- design_opportunities — a designer sees only their own.
-- ---------------------------------------------------------------------------

CREATE POLICY design_opportunities_select ON design_opportunities
  FOR SELECT TO authenticated
  USING (
    designer_id = my_designer_id()
    OR is_admin()
    OR owns_design_request(request_id)
  );

CREATE POLICY design_opportunities_update_own ON design_opportunities
  FOR UPDATE TO authenticated
  USING (designer_id = my_designer_id()) WITH CHECK (designer_id = my_designer_id());

CREATE POLICY design_opportunities_answer ON design_opportunities
  FOR UPDATE TO authenticated
  USING (owns_design_request(request_id)) WITH CHECK (owns_design_request(request_id));

/*
  Mirrors guard_opportunity_identity, including the IDOR fix that motivated
  it: without this a designer could PATCH their own opportunity's request_id
  to an unrelated request and gain read/propose access, bypassing specialty
  matching entirely.
*/
CREATE OR REPLACE FUNCTION public.guard_design_opportunity_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_is_designer boolean;
  v_is_customer boolean;
BEGIN
  IF current_user = 'postgres' OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.request_id IS DISTINCT FROM OLD.request_id THEN
    RAISE EXCEPTION 'An opportunity cannot be moved to another request.';
  END IF;
  IF NEW.designer_id IS DISTINCT FROM OLD.designer_id THEN
    RAISE EXCEPTION 'An opportunity cannot be reassigned to another designer.';
  END IF;

  v_is_designer := OLD.designer_id = my_designer_id();
  v_is_customer := owns_design_request(OLD.request_id);

  IF v_is_designer THEN
    IF NEW.answer IS DISTINCT FROM OLD.answer THEN
      RAISE EXCEPTION 'Only the customer can answer a clarification question.';
    END IF;
  ELSIF v_is_customer THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only the designer can update this opportunity''s status.';
    END IF;
    IF NEW.question IS DISTINCT FROM OLD.question THEN
      RAISE EXCEPTION 'Only the designer can ask a clarification question.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_design_opportunity_identity
  BEFORE UPDATE ON design_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.guard_design_opportunity_identity();

-- ---------------------------------------------------------------------------
-- design_proposals — the authoring designer sees their own at any status;
-- the customer sees only what was actually submitted to them. A designer can
-- never see a competitor's proposal at all.
-- ---------------------------------------------------------------------------

CREATE POLICY design_proposals_select_own_designer ON design_proposals
  FOR SELECT TO authenticated USING (designer_id = my_designer_id() OR is_admin());

CREATE POLICY design_proposals_select_customer ON design_proposals
  FOR SELECT TO authenticated
  USING (
    status IN ('SUBMITTED', 'SELECTED', 'NOT_SELECTED')
    AND owns_design_request(request_id)
  );

CREATE POLICY design_proposals_insert_own ON design_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    designer_id = my_designer_id()
    AND status = 'DRAFT'
    AND can_propose_on(request_id)
  );

CREATE POLICY design_proposals_update_own ON design_proposals
  FOR UPDATE TO authenticated
  USING (designer_id = my_designer_id() AND status IN ('DRAFT', 'SUBMITTED'))
  WITH CHECK (designer_id = my_designer_id());

CREATE OR REPLACE FUNCTION public.guard_design_proposal_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'postgres' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Proposal status changes through PrintAir actions, not direct edits.';
  END IF;
  IF NEW.designer_id IS DISTINCT FROM OLD.designer_id OR NEW.request_id IS DISTINCT FROM OLD.request_id THEN
    RAISE EXCEPTION 'A proposal cannot be moved to another request or designer.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_design_proposal_status
  BEFORE UPDATE ON design_proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_design_proposal_status();

-- ---------------------------------------------------------------------------
-- design_orders / events / deliverables / payments — the two parties only.
-- ---------------------------------------------------------------------------

CREATE POLICY design_orders_select ON design_orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR designer_id = my_designer_id() OR is_admin());

CREATE POLICY design_order_events_select ON design_order_status_events
  FOR SELECT TO authenticated
  USING (can_read_design_order(order_id) OR is_admin());

CREATE POLICY design_deliverables_select ON design_deliverables
  FOR SELECT TO authenticated
  USING (can_read_design_order(order_id) OR is_admin());

CREATE POLICY design_payments_select ON design_payments
  FOR SELECT TO authenticated
  USING (can_read_design_order(order_id) OR is_admin());

-- ---------------------------------------------------------------------------
-- design_reviews — public once written, unless an admin has hidden them.
-- ---------------------------------------------------------------------------

CREATE POLICY design_reviews_public_read ON design_reviews
  FOR SELECT TO anon, authenticated
  USING (hidden = false OR customer_id = auth.uid() OR is_admin());

-- ---------------------------------------------------------------------------
-- Function grants — revoke PUBLIC's default EXECUTE, re-grant explicitly,
-- matching 20260806000200_hardening.sql.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.my_designer_id()                                        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_design_request(uuid)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_editable_design_request(uuid)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.designer_has_opportunity(uuid)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.designer_has_order(uuid)                                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_propose_on(uuid)                                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_design_order(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.design_order_stage_rank(text)                           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_design_request(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_design_request(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_design_proposal(uuid)                            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_design_proposal(uuid)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.select_design_proposal(uuid)                            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_design_order_status(uuid, text, text)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_design_deliverable(uuid, text, text, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_design_deliverable(uuid, boolean, text)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_design_review(uuid, int, text, boolean)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_designer(uuid, text, text)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_design_review(uuid, boolean, text)       FROM PUBLIC;

-- designer_portfolio_public_read is an anon-facing policy that reaches
-- designer_profiles, so anon needs nothing extra here; my_designer_id() is
-- only ever called from authenticated-only policies and RPCs.
GRANT EXECUTE ON FUNCTION
  public.my_designer_id(),
  public.owns_design_request(uuid),
  public.owns_editable_design_request(uuid),
  public.designer_has_opportunity(uuid),
  public.designer_has_order(uuid),
  public.can_propose_on(uuid),
  public.can_read_design_order(uuid),
  public.design_order_stage_rank(text),
  public.submit_design_request(uuid),
  public.cancel_design_request(uuid),
  public.submit_design_proposal(uuid),
  public.withdraw_design_proposal(uuid),
  public.select_design_proposal(uuid),
  public.update_design_order_status(uuid, text, text),
  public.submit_design_deliverable(uuid, text, text, text, bigint),
  public.review_design_deliverable(uuid, boolean, text),
  public.create_design_review(uuid, int, text, boolean),
  public.admin_review_designer(uuid, text, text),
  public.admin_moderate_design_review(uuid, boolean, text)
TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage.
--
-- Three buckets rather than one, so each path's first segment is
-- unambiguously one kind of id and the policies stay readable:
--   designer-portfolio  <designer_id>/<file>  public read (it is a shopfront)
--   design-briefs       <request_id>/<file>   private
--   design-deliverables <order_id>/<file>     private
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('designer-portfolio', 'designer-portfolio', true, 10485760,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('design-briefs', 'design-briefs', false, 26214400,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
         'application/zip', 'application/x-zip-compressed', 'application/octet-stream']),
  ('design-deliverables', 'design-deliverables', false, 52428800,
   ARRAY['application/pdf', 'image/jpeg', 'image/png',
         'application/postscript', 'application/illustrator',
         'application/zip', 'application/x-zip-compressed', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Portfolio: the owning designer writes, everyone reads (bucket is public,
-- but an explicit SELECT policy keeps behaviour the same if it is ever flipped).
CREATE POLICY designer_portfolio_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'designer-portfolio'
    AND nullif(split_part(name, '/', 1), '')::uuid = public.my_designer_id()
  );

CREATE POLICY designer_portfolio_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'designer-portfolio');

CREATE POLICY designer_portfolio_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'designer-portfolio'
    AND nullif(split_part(name, '/', 1), '')::uuid = public.my_designer_id()
  );

-- Briefs: customer writes; any designer holding an opportunity may read.
CREATE POLICY design_briefs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'design-briefs'
    AND public.owns_design_request(nullif(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY design_briefs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'design-briefs'
    AND (
      public.owns_design_request(nullif(split_part(name, '/', 1), '')::uuid)
      OR public.designer_has_opportunity(nullif(split_part(name, '/', 1), '')::uuid)
      OR public.is_admin()
    )
  );

CREATE POLICY design_briefs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'design-briefs'
    AND public.owns_editable_design_request(nullif(split_part(name, '/', 1), '')::uuid)
  );

-- Deliverables: only the two parties on that order. Path is the order id, so
-- can_read_design_order() answers it directly.
CREATE POLICY design_deliverables_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'design-deliverables'
    AND EXISTS (
      SELECT 1 FROM design_orders
      WHERE id = nullif(split_part(name, '/', 1), '')::uuid
        AND designer_id = public.my_designer_id()
    )
  );

CREATE POLICY design_deliverables_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'design-deliverables'
    AND (
      public.can_read_design_order(nullif(split_part(name, '/', 1), '')::uuid)
      OR public.is_admin()
    )
  );
