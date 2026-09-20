/*
  PrintAir — designer marketplace, functions and RPCs.

  Same discipline as the print marketplace: every state-changing operation is
  a SECURITY DEFINER function, never a raw client UPDATE, so ownership checks
  and status-transition rules live in one auditable place and each state
  change is atomic.
*/

-- ---------------------------------------------------------------------------
-- Identity helper — mirrors my_partner_id().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_designer_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM designer_profiles WHERE user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Signup: extend handle_new_user() with a designer branch.
--
-- Carries forward the critical-security-patch fix unchanged (admin only ever
-- from raw_app_meta_data — a public signUp() call can never set that). Adding
-- 'designer' here does not touch that guard.
--
-- Unlike a partner, a designer signup does NOT immediately create an active,
-- job-ready workspace — designer_profiles.status defaults to 'pending_review'
-- (decision #4: every designer needs a human approval click). Specialties
-- chosen at signup are still recorded, so the application already carries
-- what the designer wants to be reviewed for.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta         jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_app_meta     jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_role         text;
  v_full_name    text;
  v_partner_id   uuid;
  v_designer_id  uuid;
  v_category     text;
  v_specialty    text;
BEGIN
  IF v_app_meta ->> 'role' = 'admin' THEN
    v_role := 'admin';
  ELSE
    v_role := coalesce(nullif(btrim(v_meta ->> 'role'), ''), 'customer');
    IF v_role NOT IN ('customer', 'partner', 'designer') THEN
      RAISE EXCEPTION 'Unknown account type "%".', v_role;
    END IF;
  END IF;

  v_full_name := coalesce(
    nullif(btrim(coalesce(v_meta ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'first_name', '') || ' ' || coalesce(v_meta ->> 'last_name', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'contact_name', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'display_name', '')), '')
  );

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'A name is required to create your account.';
  END IF;

  INSERT INTO profiles (id, role, full_name, email, mobile, city)
  VALUES (
    NEW.id,
    v_role,
    v_full_name,
    NEW.email,
    nullif(btrim(coalesce(v_meta ->> 'mobile', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'city', '')), '')
  );

  IF v_role = 'partner' THEN
    IF nullif(btrim(coalesce(v_meta ->> 'business_name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'A printing business name is required.';
    END IF;
    IF nullif(btrim(coalesce(v_meta ->> 'city', '')), '') IS NULL THEN
      RAISE EXCEPTION 'A city is required for your printing business.';
    END IF;

    INSERT INTO partner_profiles (user_id, business_name, contact_name, city, services)
    VALUES (
      NEW.id,
      btrim(v_meta ->> 'business_name'),
      coalesce(nullif(btrim(coalesce(v_meta ->> 'contact_name', '')), ''), v_full_name),
      btrim(v_meta ->> 'city'),
      coalesce(ARRAY(SELECT jsonb_array_elements_text(v_meta -> 'services')), '{}'::text[])
    )
    RETURNING id INTO v_partner_id;

    FOR v_category IN
      SELECT jsonb_array_elements_text(coalesce(v_meta -> 'categories', '[]'::jsonb))
    LOOP
      IF EXISTS (SELECT 1 FROM print_categories WHERE id = v_category) THEN
        INSERT INTO partner_capabilities (partner_id, category)
        VALUES (v_partner_id, v_category)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF v_role = 'designer' THEN
    IF nullif(btrim(coalesce(v_meta ->> 'city', '')), '') IS NULL THEN
      RAISE EXCEPTION 'A city is required for your designer profile.';
    END IF;

    INSERT INTO designer_profiles (user_id, display_name, city, bio, application_note)
    VALUES (
      NEW.id,
      v_full_name,
      btrim(v_meta ->> 'city'),
      nullif(btrim(coalesce(v_meta ->> 'bio', '')), ''),
      nullif(btrim(coalesce(v_meta ->> 'application_note', '')), '')
    )
    RETURNING id INTO v_designer_id;

    FOR v_specialty IN
      SELECT jsonb_array_elements_text(coalesce(v_meta -> 'specialties', '[]'::jsonb))
    LOOP
      IF EXISTS (SELECT 1 FROM design_specialties WHERE id = v_specialty) THEN
        INSERT INTO designer_specialties (designer_id, specialty)
        VALUES (v_designer_id, v_specialty)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Opportunity distribution — mirrors distribute_opportunities(), matched by
-- specialty instead of category, gated on designer_profiles.status = 'active'
-- rather than 'active' meaning something different pre-approval.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.distribute_design_opportunities() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'OPEN_FOR_PROPOSALS' AND OLD.status IS DISTINCT FROM 'OPEN_FOR_PROPOSALS' THEN
    INSERT INTO design_opportunities (request_id, designer_id)
    SELECT NEW.id, ds.designer_id
    FROM designer_specialties ds
    JOIN designer_profiles dp ON dp.id = ds.designer_id
    JOIN profiles pr          ON pr.id = dp.user_id
    WHERE ds.specialty = NEW.specialty
      AND dp.status = 'active'
      AND pr.status = 'active'
    ON CONFLICT (request_id, designer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_distribute_design_opportunities
  AFTER UPDATE OF status ON design_requests
  FOR EACH ROW EXECUTE FUNCTION public.distribute_design_opportunities();

-- ---------------------------------------------------------------------------
-- Request lifecycle — mirrors submit_project() / cancel_project().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_design_request(p_request_id uuid) RETURNS design_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request design_requests;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_request FROM design_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That design request no longer exists.';
  END IF;
  IF v_request.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own design requests.';
  END IF;
  IF v_request.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'This design request has already been submitted.';
  END IF;
  IF nullif(btrim(coalesce(v_request.description, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Add a short description of what you need designed before submitting.';
  END IF;

  UPDATE design_requests
     SET status = 'OPEN_FOR_PROPOSALS', submitted_at = now()
   WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_design_request(p_request_id uuid) RETURNS design_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request design_requests;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_request FROM design_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That design request no longer exists.';
  END IF;
  IF v_request.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only cancel your own design requests.';
  END IF;
  IF v_request.status NOT IN ('DRAFT', 'OPEN_FOR_PROPOSALS') THEN
    RAISE EXCEPTION 'You can no longer cancel this request — a designer has already been selected.';
  END IF;

  UPDATE design_requests SET status = 'CANCELLED' WHERE id = p_request_id RETURNING * INTO v_request;
  UPDATE design_proposals SET status = 'NOT_SELECTED'
   WHERE request_id = p_request_id AND status IN ('DRAFT', 'SUBMITTED');

  RETURN v_request;
END;
$$;

-- ---------------------------------------------------------------------------
-- Proposal lifecycle — mirrors submit_quote() / withdraw_quote().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_design_proposal(p_proposal_id uuid) RETURNS design_proposals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal design_proposals;
  v_status   text;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_proposal FROM design_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That proposal no longer exists.';
  END IF;
  IF v_proposal.designer_id IS DISTINCT FROM my_designer_id() THEN
    RAISE EXCEPTION 'You can only submit your own proposals.';
  END IF;
  IF v_proposal.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'This proposal has already been submitted.';
  END IF;

  SELECT status INTO v_status FROM design_requests WHERE id = v_proposal.request_id;
  IF v_status <> 'OPEN_FOR_PROPOSALS' THEN
    RAISE EXCEPTION 'This design request is no longer accepting proposals.';
  END IF;

  IF v_proposal.price IS NULL OR v_proposal.price <= 0 THEN
    RAISE EXCEPTION 'Enter a price greater than zero.';
  END IF;
  IF v_proposal.turnaround_days IS NULL OR v_proposal.turnaround_days <= 0 THEN
    RAISE EXCEPTION 'Enter a turnaround of at least one day.';
  END IF;
  IF v_proposal.down_payment_pct IS NULL THEN
    RAISE EXCEPTION 'Enter the down payment you require.';
  END IF;
  IF v_proposal.valid_until IS NOT NULL AND v_proposal.valid_until < current_date THEN
    RAISE EXCEPTION 'The validity date has already passed.';
  END IF;

  UPDATE design_proposals SET status = 'SUBMITTED', submitted_at = now()
   WHERE id = p_proposal_id RETURNING * INTO v_proposal;

  UPDATE design_opportunities SET status = 'PROPOSED'
   WHERE request_id = v_proposal.request_id AND designer_id = v_proposal.designer_id;

  RETURN v_proposal;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_design_proposal(p_proposal_id uuid) RETURNS design_proposals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proposal design_proposals;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_proposal FROM design_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That proposal no longer exists.';
  END IF;
  IF v_proposal.designer_id IS DISTINCT FROM my_designer_id() THEN
    RAISE EXCEPTION 'You can only withdraw your own proposals.';
  END IF;
  IF v_proposal.status NOT IN ('DRAFT', 'SUBMITTED') THEN
    RAISE EXCEPTION 'This proposal can no longer be withdrawn.';
  END IF;

  UPDATE design_proposals SET status = 'WITHDRAWN' WHERE id = p_proposal_id RETURNING * INTO v_proposal;

  UPDATE design_opportunities SET status = 'VIEWED'
   WHERE request_id = v_proposal.request_id AND designer_id = v_proposal.designer_id;

  RETURN v_proposal;
END;
$$;

-- ---------------------------------------------------------------------------
-- Designer selection — mirrors select_quote(), opening AWAITING_PAYMENT with
-- a design_payments row directly (see the schema migration's note on why
-- this does not repeat the print side's CONFIRMED-first history).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.select_design_proposal(p_proposal_id uuid) RETURNS design_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal design_proposals;
  v_request  design_requests;
  v_order    design_orders;
  v_fee      numeric(12,2);
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_proposal FROM design_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That proposal no longer exists.';
  END IF;

  SELECT * INTO v_request FROM design_requests WHERE id = v_proposal.request_id FOR UPDATE;
  IF v_request.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only choose a designer for your own request.';
  END IF;
  IF v_request.status <> 'OPEN_FOR_PROPOSALS' THEN
    RAISE EXCEPTION 'A designer has already been chosen for this request.';
  END IF;
  IF v_proposal.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'That proposal is no longer available to choose.';
  END IF;

  UPDATE design_proposals SET status = 'SELECTED' WHERE id = p_proposal_id;
  UPDATE design_proposals SET status = 'NOT_SELECTED'
   WHERE request_id = v_request.id
     AND id <> p_proposal_id
     AND status IN ('DRAFT', 'SUBMITTED');

  UPDATE design_requests
     SET status = 'DESIGNER_SELECTED', selected_proposal_id = p_proposal_id
   WHERE id = v_request.id;

  INSERT INTO design_orders (request_id, proposal_id, customer_id, designer_id, status)
  VALUES (v_request.id, p_proposal_id, v_request.customer_id, v_proposal.designer_id, 'AWAITING_PAYMENT')
  RETURNING * INTO v_order;

  INSERT INTO design_order_status_events (order_id, status, note, created_by)
  VALUES (v_order.id, 'AWAITING_PAYMENT', 'Designer selected. Platform fee payment required to confirm.', auth.uid());

  -- Same platform-fee mechanic as the print marketplace (decision #5).
  v_fee := round(v_proposal.price * booking_fee_pct() / 100, 2);
  INSERT INTO design_payments (order_id, amount)
  VALUES (v_order.id, v_fee);

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- Order tracking — mirrors order_stage_rank() / update_order_status().
-- No READY stage: a design deliverable has no physical pickup step.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.design_order_stage_rank(p_status text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_status
    WHEN 'AWAITING_PAYMENT' THEN 1
    WHEN 'CONFIRMED'        THEN 2
    WHEN 'IN_PROGRESS'      THEN 3
    WHEN 'DELIVERED'        THEN 4
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_design_order_status(
  p_order_id uuid, p_status text, p_note text DEFAULT NULL
) RETURNS design_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order design_orders;
BEGIN
  PERFORM assert_active();

  IF design_order_stage_rank(p_status) IS NULL THEN
    RAISE EXCEPTION 'Unknown status "%".', p_status;
  END IF;
  IF p_status = 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'Orders cannot be moved back to awaiting payment.';
  END IF;

  SELECT * INTO v_order FROM design_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That design order no longer exists.';
  END IF;
  IF v_order.designer_id IS DISTINCT FROM my_designer_id() THEN
    RAISE EXCEPTION 'Only the selected designer can update this order.';
  END IF;
  IF v_order.status = 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'This order is still awaiting the customer''s platform fee payment.';
  END IF;
  IF design_order_stage_rank(p_status) <= design_order_stage_rank(v_order.status) THEN
    RAISE EXCEPTION 'This order is already at "%" — status cannot move backwards.', v_order.status;
  END IF;

  UPDATE design_orders
     SET status = p_status,
         delivered_at = CASE WHEN p_status = 'DELIVERED' THEN now() ELSE delivered_at END
   WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO design_order_status_events (order_id, status, note, created_by)
  VALUES (p_order_id, p_status, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- Deliverables — the new revision-tracking piece. No print-side analogue to
-- mirror; the shape here is set by the plan (decision #6), not by precedent.
-- ---------------------------------------------------------------------------

/*
  A designer uploads a revision. revision_number is computed server-side
  (max existing + 1) rather than trusted from the client, so two concurrent
  submissions can never collide on the same number, and a client cannot
  claim revision 1 twice or skip ahead.

  Revision-count enforcement against design_proposals.revision_rounds_included
  is deliberately NOT done here — the plan leaves the revision-limit policy
  open (see the schema migration's note on that column). A designer can
  submit more rounds than were included; any extra-rounds charge is a
  future/manual matter between the parties, not a system block.

  First deliverable on an order moves it CONFIRMED -> IN_PROGRESS. This
  writes design_orders.status directly rather than calling
  update_design_order_status(), because that RPC's ownership/forward-only
  checks would just re-derive what is already established here — the caller
  is already proven to be the assigned designer.
*/
CREATE OR REPLACE FUNCTION public.submit_design_deliverable(
  p_order_id uuid, p_storage_path text, p_file_name text,
  p_mime_type text DEFAULT NULL, p_size_bytes bigint DEFAULT NULL
) RETURNS design_deliverables
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order      design_orders;
  v_next_rev   int;
  v_deliverable design_deliverables;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_order FROM design_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That design order no longer exists.';
  END IF;
  IF v_order.designer_id IS DISTINCT FROM my_designer_id() THEN
    RAISE EXCEPTION 'Only the assigned designer can upload a deliverable for this order.';
  END IF;
  IF v_order.status NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'This order is not in a state that accepts a deliverable.';
  END IF;
  IF nullif(btrim(coalesce(p_storage_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A file is required.';
  END IF;

  SELECT coalesce(max(revision_number), 0) + 1 INTO v_next_rev
  FROM design_deliverables WHERE order_id = p_order_id;

  INSERT INTO design_deliverables (order_id, revision_number, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  VALUES (p_order_id, v_next_rev, btrim(p_storage_path), btrim(p_file_name), p_mime_type, p_size_bytes, auth.uid())
  RETURNING * INTO v_deliverable;

  IF v_order.status = 'CONFIRMED' THEN
    UPDATE design_orders SET status = 'IN_PROGRESS' WHERE id = p_order_id;
    INSERT INTO design_order_status_events (order_id, status, note, created_by)
    VALUES (p_order_id, 'IN_PROGRESS', 'First deliverable submitted.', auth.uid());
  END IF;

  RETURN v_deliverable;
END;
$$;

/*
  The customer approves a revision or sends it back with feedback. Approving
  the deliverable also closes the order — DELIVERED — since v1 has no
  distinct "final handoff" step beyond the customer accepting the file.
  Sending feedback (approved = false) leaves the order IN_PROGRESS; the
  designer's next call to submit_design_deliverable() opens the next
  revision_number.
*/
CREATE OR REPLACE FUNCTION public.review_design_deliverable(
  p_deliverable_id uuid, p_approved boolean, p_feedback text DEFAULT NULL
) RETURNS design_deliverables
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deliverable design_deliverables;
  v_order       design_orders;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_deliverable FROM design_deliverables WHERE id = p_deliverable_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That deliverable no longer exists.';
  END IF;

  SELECT * INTO v_order FROM design_orders WHERE id = v_deliverable.order_id FOR UPDATE;
  IF v_order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only review deliverables on your own order.';
  END IF;
  IF v_order.status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'This order is not awaiting review.';
  END IF;
  IF v_deliverable.approved THEN
    RAISE EXCEPTION 'This deliverable has already been approved.';
  END IF;
  IF p_approved IS NULL THEN
    RAISE EXCEPTION 'State whether this deliverable is approved.';
  END IF;
  IF NOT p_approved AND nullif(btrim(coalesce(p_feedback, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Add feedback so the designer knows what to change.';
  END IF;

  UPDATE design_deliverables
     SET approved = p_approved,
         approved_at = CASE WHEN p_approved THEN now() ELSE NULL END,
         customer_feedback = nullif(btrim(coalesce(p_feedback, '')), '')
   WHERE id = p_deliverable_id
  RETURNING * INTO v_deliverable;

  IF p_approved THEN
    UPDATE design_orders SET status = 'DELIVERED', delivered_at = now() WHERE id = v_order.id;
    INSERT INTO design_order_status_events (order_id, status, note, created_by)
    VALUES (v_order.id, 'DELIVERED', 'Deliverable approved by customer.', auth.uid());

    UPDATE design_requests SET status = 'DELIVERED' WHERE id = v_order.request_id;
  END IF;

  RETURN v_deliverable;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reviews — mirrors create_review().
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_design_review(
  p_order_id uuid, p_rating int, p_comment text DEFAULT NULL, p_would_work_again boolean DEFAULT true
) RETURNS design_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order  design_orders;
  v_review design_reviews;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_order FROM design_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That design order no longer exists.';
  END IF;
  IF v_order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only review your own orders.';
  END IF;
  IF v_order.status <> 'DELIVERED' THEN
    RAISE EXCEPTION 'You can leave a review once the order has been delivered.';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Choose a rating from 1 to 5.';
  END IF;
  IF EXISTS (SELECT 1 FROM design_reviews WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'You have already reviewed this order.';
  END IF;

  INSERT INTO design_reviews (order_id, request_id, customer_id, designer_id, rating, comment, would_work_again)
  VALUES (p_order_id, v_order.request_id, v_order.customer_id, v_order.designer_id,
          p_rating, nullif(btrim(coalesce(p_comment, '')), ''), coalesce(p_would_work_again, true))
  RETURNING * INTO v_review;

  RETURN v_review;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public directory — mirrors partner_directory. Approved (status='active')
-- designers only; pending/rejected/suspended never appear here.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.designer_directory
WITH (security_invoker = false) AS
SELECT
  dp.id,
  dp.display_name,
  dp.city,
  dp.bio,
  dp.avatar_url,
  dp.typical_turnaround_days,
  dp.rate_min,
  dp.rate_max,
  dp.created_at,
  coalesce(ARRAY(
    SELECT ds.specialty FROM designer_specialties ds WHERE ds.designer_id = dp.id ORDER BY ds.specialty
  ), '{}'::text[]) AS specialties,
  coalesce((
    SELECT count(*) FROM designer_portfolio_items WHERE designer_id = dp.id
  ), 0) AS portfolio_count,
  coalesce(r.avg_rating, 0)::numeric(3,2) AS average_rating,
  coalesce(r.review_count, 0)             AS review_count,
  coalesce(o.completed_count, 0)          AS completed_orders
FROM designer_profiles dp
LEFT JOIN LATERAL (
  SELECT avg(rating) AS avg_rating, count(*) AS review_count
  FROM design_reviews WHERE designer_id = dp.id AND hidden = false
) r ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS completed_count
  FROM design_orders WHERE designer_id = dp.id AND status = 'DELIVERED'
) o ON true
WHERE dp.status = 'active';

GRANT SELECT ON public.designer_directory TO anon, authenticated;

/*
  Admin-only review queue (decision #4 / plan section 5). Automated checks
  surface as boolean flags on a pending_review designer — they never gate the
  application; a human always makes the actual approve/reject call in
  admin_review_designer() below.

  Thresholds are intentionally simple (a count, a format allow-list, a pixel
  floor) — deep colour-profile/DPI analysis is explicitly out of scope for v1.
*/
CREATE OR REPLACE VIEW public.designer_admin_review_queue
WITH (security_invoker = false) AS
SELECT
  dp.id,
  dp.display_name,
  dp.city,
  dp.bio,
  dp.application_note,
  dp.created_at AS applied_at,
  coalesce(ARRAY(
    SELECT ds.specialty FROM designer_specialties ds WHERE ds.designer_id = dp.id ORDER BY ds.specialty
  ), '{}'::text[]) AS specialties,
  coalesce(pi.portfolio_count, 0) AS portfolio_count,
  coalesce(pi.portfolio_count, 0) < 3 AS flag_low_sample_count,
  coalesce(pi.bad_format_count, 0) > 0 AS flag_bad_format,
  coalesce(pi.low_res_count, 0) > 0 AS flag_low_resolution
FROM designer_profiles dp
LEFT JOIN LATERAL (
  SELECT
    count(*) AS portfolio_count,
    count(*) FILTER (
      WHERE mime_type IS NOT NULL
        AND mime_type NOT IN (
          'application/pdf', 'application/postscript', 'application/illustrator',
          'image/jpeg', 'image/png'
        )
    ) AS bad_format_count,
    count(*) FILTER (
      WHERE width_px IS NOT NULL AND height_px IS NOT NULL
        AND width_px < 800 AND height_px < 800
    ) AS low_res_count
  FROM designer_portfolio_items WHERE designer_id = dp.id
) pi ON true
WHERE dp.status = 'pending_review';

GRANT SELECT ON public.designer_admin_review_queue TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin actions — mirrors admin_set_account_status() / admin_moderate_review(),
-- always require a written reason, always audited.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_review_designer(
  p_designer_id uuid, p_decision text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  IF p_decision NOT IN ('active', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Decision must be active, rejected, or suspended.';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  SELECT status INTO v_current_status FROM designer_profiles WHERE id = p_designer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That designer no longer exists.';
  END IF;
  IF p_decision IN ('active', 'rejected') AND v_current_status <> 'pending_review' THEN
    RAISE EXCEPTION 'This application has already been decided.';
  END IF;
  IF p_decision = 'suspended' AND v_current_status <> 'active' THEN
    RAISE EXCEPTION 'Only an active designer can be suspended.';
  END IF;

  UPDATE designer_profiles
     SET status = p_decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_reason = btrim(p_reason)
   WHERE id = p_designer_id;

  INSERT INTO admin_audit_log (actor_id, action, target_table, target_id, reason)
  VALUES (auth.uid(), 'designer_review:' || p_decision, 'designer_profiles', p_designer_id, btrim(p_reason));
END;
$$;

/*
  admin_set_account_status() predates the designer role and only cascaded a
  suspension into partner_profiles, so suspending a designer's account left
  their designer_profiles row 'active' — and distribute_design_opportunities()
  matches on exactly that, meaning a suspended designer would have kept
  receiving work. Redefined here to cascade to both.

  designer_profiles.status is not a straight copy of the account status: a
  suspended designer is reinstated to 'active', but only from 'suspended' —
  reactivating an account must never promote an application that was still
  pending_review or was rejected into a live designer, which would bypass the
  human approval gate entirely.
*/
CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  p_user_id uuid, p_status text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Status must be active or suspended.';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot suspend your own account.';
  END IF;

  UPDATE profiles SET status = p_status WHERE id = p_user_id;
  UPDATE partner_profiles SET status = p_status WHERE user_id = p_user_id;

  IF p_status = 'suspended' THEN
    UPDATE designer_profiles SET status = 'suspended'
     WHERE user_id = p_user_id AND status = 'active';
  ELSE
    UPDATE designer_profiles SET status = 'active'
     WHERE user_id = p_user_id AND status = 'suspended';
  END IF;

  INSERT INTO admin_audit_log (actor_id, action, target_table, target_id, reason)
  VALUES (auth.uid(), 'set_account_status:' || p_status, 'profiles', p_user_id, btrim(p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_design_review(
  p_review_id uuid, p_hidden boolean, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  IF nullif(btrim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required.';
  END IF;

  UPDATE design_reviews
     SET hidden = p_hidden,
         hidden_reason = CASE WHEN p_hidden THEN btrim(p_reason) ELSE NULL END
   WHERE id = p_review_id;

  INSERT INTO admin_audit_log (actor_id, action, target_table, target_id, reason)
  VALUES (auth.uid(), CASE WHEN p_hidden THEN 'hide_design_review' ELSE 'unhide_design_review' END,
          'design_reviews', p_review_id, btrim(p_reason));
END;
$$;
