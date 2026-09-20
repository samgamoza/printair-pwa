/*
  PrintAir — helper functions, signup wiring, and the state-changing RPCs.

  Every operation that moves the marketplace forward (submit a project, submit a
  quote, select a provider, advance an order, leave a review) is a SECURITY
  DEFINER function rather than a raw client UPDATE. That keeps ownership checks
  and status-transition rules in one auditable place instead of scattered across
  the UI, and makes the whole state change atomic.
*/

-- ---------------------------------------------------------------------------
-- Identity helpers (SECURITY DEFINER so RLS policies can call them without
-- recursing back into the policies on profiles)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- The calling user's partner_profiles.id, or NULL if they are not a partner.
CREATE OR REPLACE FUNCTION public.my_partner_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM partner_profiles WHERE user_id = auth.uid();
$$;

-- Guard used by every RPC: a suspended account can read but cannot act.
CREATE OR REPLACE FUNCTION public.assert_active() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You need to be signed in to do that.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'This account is suspended. Contact PrintAir support.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Email-first sign-in flow
-- ---------------------------------------------------------------------------

/*
  Powers the "Log in or sign up" screen: the user types an email, and we route
  them to a password prompt or to account creation.

  This deliberately reveals whether an email is registered, because the UX
  requires it. That is the same trade every email-first flow makes. It is
  narrowed as far as it can be: it returns only a boolean, never any profile
  data, and Supabase's own auth rate limits still apply to the sign-in attempt
  that follows. If email enumeration is unacceptable later, the fix is to drop
  this function and split the screen into explicit Log in / Sign up tabs.
*/
CREATE OR REPLACE FUNCTION public.email_exists(p_email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(btrim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists(text) FROM public;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup: create the profile (and partner workspace) in the same transaction
-- as the auth user. If anything here raises, the auth.users insert rolls back —
-- so we never end up with an account that has no usable workspace, or a profile
-- with no account.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta        jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_role        text  := coalesce(nullif(btrim(v_meta ->> 'role'), ''), 'customer');
  v_full_name   text;
  v_partner_id  uuid;
  v_category    text;
BEGIN
  IF v_role NOT IN ('customer', 'partner', 'admin') THEN
    RAISE EXCEPTION 'Unknown account type "%".', v_role;
  END IF;

  -- Customers sign up with first/last name, partners with a contact name.
  -- Each candidate is emptied to NULL first so a blank one falls through
  -- instead of satisfying coalesce with an empty string.
  v_full_name := coalesce(
    nullif(btrim(coalesce(v_meta ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'first_name', '') || ' ' || coalesce(v_meta ->> 'last_name', '')), ''),
    nullif(btrim(coalesce(v_meta ->> 'contact_name', '')), '')
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
      coalesce(
        ARRAY(SELECT jsonb_array_elements_text(v_meta -> 'services')),
        '{}'::text[]
      )
    )
    RETURNING id INTO v_partner_id;

    -- "Main printing services" from signup are stored as matching categories.
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep the profile email in step with the auth email.
CREATE OR REPLACE FUNCTION public.handle_user_email_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Opportunity distribution
-- ---------------------------------------------------------------------------

/*
  When a project opens for quotes, every active partner whose capabilities
  include the project's category gets one identical opportunity row.
  No scoring, no ranking, no ordering, no cap.
*/
CREATE OR REPLACE FUNCTION public.distribute_opportunities() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'OPEN_FOR_QUOTES' AND OLD.status IS DISTINCT FROM 'OPEN_FOR_QUOTES' THEN
    INSERT INTO opportunities (project_id, partner_id)
    SELECT NEW.id, pc.partner_id
    FROM partner_capabilities pc
    JOIN partner_profiles pp ON pp.id = pc.partner_id
    JOIN profiles pr        ON pr.id = pp.user_id
    WHERE pc.category = NEW.category
      AND pp.status = 'active'
      AND pr.status = 'active'
    ON CONFLICT (project_id, partner_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_distribute_opportunities
  AFTER UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION public.distribute_opportunities();

-- ---------------------------------------------------------------------------
-- Project lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_project(p_project_id uuid) RETURNS projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project projects;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That project no longer exists.';
  END IF;
  IF v_project.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only submit your own projects.';
  END IF;
  IF v_project.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'This project has already been submitted.';
  END IF;
  IF nullif(btrim(coalesce(v_project.description, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Add a short description of what you need printed before submitting.';
  END IF;
  IF nullif(btrim(coalesce(v_project.delivery_city, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Add a delivery city before submitting.';
  END IF;

  UPDATE projects
     SET status = 'OPEN_FOR_QUOTES', submitted_at = now()
   WHERE id = p_project_id
  RETURNING * INTO v_project;

  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_project(p_project_id uuid) RETURNS projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_project projects;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That project no longer exists.';
  END IF;
  IF v_project.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only cancel your own projects.';
  END IF;
  IF v_project.status NOT IN ('DRAFT', 'OPEN_FOR_QUOTES') THEN
    RAISE EXCEPTION 'You can no longer cancel this project — a printing partner has already been selected.';
  END IF;

  UPDATE projects SET status = 'CANCELLED' WHERE id = p_project_id RETURNING * INTO v_project;
  UPDATE quotes   SET status = 'NOT_SELECTED'
   WHERE project_id = p_project_id AND status IN ('DRAFT', 'SUBMITTED');

  RETURN v_project;
END;
$$;

-- ---------------------------------------------------------------------------
-- Quotation lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_quote(p_quote_id uuid) RETURNS quotes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote  quotes;
  v_status text;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That quotation no longer exists.';
  END IF;
  IF v_quote.partner_id IS DISTINCT FROM my_partner_id() THEN
    RAISE EXCEPTION 'You can only submit your own quotations.';
  END IF;
  IF v_quote.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'This quotation has already been submitted.';
  END IF;

  SELECT status INTO v_status FROM projects WHERE id = v_quote.project_id;
  IF v_status <> 'OPEN_FOR_QUOTES' THEN
    RAISE EXCEPTION 'This project is no longer accepting quotations.';
  END IF;

  IF v_quote.total_price IS NULL OR v_quote.total_price <= 0 THEN
    RAISE EXCEPTION 'Enter a total price greater than zero.';
  END IF;
  IF v_quote.turnaround_days IS NULL OR v_quote.turnaround_days <= 0 THEN
    RAISE EXCEPTION 'Enter a turnaround of at least one day.';
  END IF;
  IF v_quote.down_payment_pct IS NULL THEN
    RAISE EXCEPTION 'Enter the down payment you require.';
  END IF;
  IF v_quote.valid_until IS NOT NULL AND v_quote.valid_until < current_date THEN
    RAISE EXCEPTION 'The validity date has already passed.';
  END IF;

  UPDATE quotes SET status = 'SUBMITTED', submitted_at = now()
   WHERE id = p_quote_id RETURNING * INTO v_quote;

  UPDATE opportunities SET status = 'QUOTED'
   WHERE project_id = v_quote.project_id AND partner_id = v_quote.partner_id;

  RETURN v_quote;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_quote(p_quote_id uuid) RETURNS quotes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_quote quotes;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That quotation no longer exists.';
  END IF;
  IF v_quote.partner_id IS DISTINCT FROM my_partner_id() THEN
    RAISE EXCEPTION 'You can only withdraw your own quotations.';
  END IF;
  IF v_quote.status NOT IN ('DRAFT', 'SUBMITTED') THEN
    RAISE EXCEPTION 'This quotation can no longer be withdrawn.';
  END IF;

  UPDATE quotes SET status = 'WITHDRAWN' WHERE id = p_quote_id RETURNING * INTO v_quote;

  UPDATE opportunities SET status = 'VIEWED'
   WHERE project_id = v_quote.project_id AND partner_id = v_quote.partner_id;

  RETURN v_quote;
END;
$$;

-- ---------------------------------------------------------------------------
-- Provider selection — the pivot of the whole marketplace, so it is one
-- atomic call: lock the project, mark the winner, mark the rest, open the order.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.select_quote(p_quote_id uuid) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote   quotes;
  v_project projects;
  v_order   orders;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That quotation no longer exists.';
  END IF;

  SELECT * INTO v_project FROM projects WHERE id = v_quote.project_id FOR UPDATE;
  IF v_project.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only choose a printing partner for your own project.';
  END IF;
  IF v_project.status <> 'OPEN_FOR_QUOTES' THEN
    RAISE EXCEPTION 'A printing partner has already been chosen for this project.';
  END IF;
  IF v_quote.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'That quotation is no longer available to choose.';
  END IF;

  UPDATE quotes SET status = 'SELECTED' WHERE id = p_quote_id;
  UPDATE quotes SET status = 'NOT_SELECTED'
   WHERE project_id = v_project.id
     AND id <> p_quote_id
     AND status IN ('DRAFT', 'SUBMITTED');

  UPDATE projects
     SET status = 'PROVIDER_SELECTED', selected_quote_id = p_quote_id
   WHERE id = v_project.id;

  INSERT INTO orders (project_id, quote_id, customer_id, partner_id, status)
  VALUES (v_project.id, p_quote_id, v_project.customer_id, v_quote.partner_id, 'CONFIRMED')
  RETURNING * INTO v_order;

  INSERT INTO order_status_events (order_id, status, note, created_by)
  VALUES (v_order.id, 'CONFIRMED', 'Printing partner selected. Project confirmed.', auth.uid());

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- Order tracking — forward-only through the four customer-facing stages.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.order_stage_rank(p_status text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_status
    WHEN 'CONFIRMED'     THEN 1
    WHEN 'IN_PRODUCTION' THEN 2
    WHEN 'READY'         THEN 3
    WHEN 'DELIVERED'     THEN 4
  END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid, p_status text, p_note text DEFAULT NULL
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order orders;
BEGIN
  PERFORM assert_active();

  IF order_stage_rank(p_status) IS NULL THEN
    RAISE EXCEPTION 'Unknown status "%".', p_status;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That project no longer exists.';
  END IF;
  IF v_order.partner_id IS DISTINCT FROM my_partner_id() THEN
    RAISE EXCEPTION 'Only the selected printing partner can update this project.';
  END IF;
  IF order_stage_rank(p_status) <= order_stage_rank(v_order.status) THEN
    RAISE EXCEPTION 'This project is already at "%" — status cannot move backwards.', v_order.status;
  END IF;

  UPDATE orders
     SET status = p_status,
         delivered_at = CASE WHEN p_status = 'DELIVERED' THEN now() ELSE delivered_at END
   WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_status_events (order_id, status, note, created_by)
  VALUES (p_order_id, p_status, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  UPDATE projects
     SET status = CASE p_status
                    WHEN 'IN_PRODUCTION' THEN 'IN_PROGRESS'
                    WHEN 'READY'         THEN 'READY'
                    WHEN 'DELIVERED'     THEN 'DELIVERED'
                    ELSE status
                  END
   WHERE id = v_order.project_id;

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- Reviews — only the customer, only once, only after delivery.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_review(
  p_order_id uuid, p_rating int, p_comment text DEFAULT NULL, p_would_work_again boolean DEFAULT true
) RETURNS reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order  orders;
  v_review reviews;
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That project no longer exists.';
  END IF;
  IF v_order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only review your own projects.';
  END IF;
  IF v_order.status <> 'DELIVERED' THEN
    RAISE EXCEPTION 'You can leave a review once the project has been delivered.';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Choose a rating from 1 to 5.';
  END IF;
  IF EXISTS (SELECT 1 FROM reviews WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'You have already reviewed this project.';
  END IF;

  INSERT INTO reviews (order_id, project_id, customer_id, partner_id, rating, comment, would_work_again)
  VALUES (p_order_id, v_order.project_id, v_order.customer_id, v_order.partner_id,
          p_rating, nullif(btrim(coalesce(p_comment, '')), ''), coalesce(p_would_work_again, true))
  RETURNING * INTO v_review;

  RETURN v_review;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public partner directory. A view so rating and completed-project counts are
-- always derived from real reviews and real delivered orders — they can never
-- drift the way stored counters do.
-- ---------------------------------------------------------------------------

-- Runs as the view owner (security_invoker = false) on purpose: the completed-
-- project count aggregates `orders`, which no anonymous visitor may read. The
-- view exposes only business info and aggregate numbers, never order rows.
CREATE OR REPLACE VIEW public.partner_directory
WITH (security_invoker = false) AS
SELECT
  pp.id,
  pp.business_name,
  pp.city,
  pp.description,
  pp.services,
  pp.logo_url,
  pp.portfolio_images,
  pp.typical_turnaround_days,
  pp.service_areas,
  pp.created_at,
  coalesce(ARRAY(
    SELECT pc.category FROM partner_capabilities pc WHERE pc.partner_id = pp.id ORDER BY pc.category
  ), '{}'::text[]) AS categories,
  coalesce(r.avg_rating, 0)::numeric(3,2) AS average_rating,
  coalesce(r.review_count, 0)             AS review_count,
  coalesce(o.completed_count, 0)          AS completed_projects
FROM partner_profiles pp
LEFT JOIN LATERAL (
  SELECT avg(rating) AS avg_rating, count(*) AS review_count
  FROM reviews WHERE partner_id = pp.id AND hidden = false
) r ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS completed_count
  FROM orders WHERE partner_id = pp.id AND status = 'DELIVERED'
) o ON true
WHERE pp.status = 'active';

GRANT SELECT ON public.partner_directory TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin actions — always require a written reason, always audited.
-- ---------------------------------------------------------------------------

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

  INSERT INTO admin_audit_log (actor_id, action, target_table, target_id, reason)
  VALUES (auth.uid(), 'set_account_status:' || p_status, 'profiles', p_user_id, btrim(p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_review(
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

  UPDATE reviews
     SET hidden = p_hidden,
         hidden_reason = CASE WHEN p_hidden THEN btrim(p_reason) ELSE NULL END
   WHERE id = p_review_id;

  INSERT INTO admin_audit_log (actor_id, action, target_table, target_id, reason)
  VALUES (auth.uid(), CASE WHEN p_hidden THEN 'hide_review' ELSE 'unhide_review' END,
          'reviews', p_review_id, btrim(p_reason));
END;
$$;
