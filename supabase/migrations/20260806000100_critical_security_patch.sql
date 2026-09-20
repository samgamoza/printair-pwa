/*
  PrintAir — critical security patch (2026-08-06 chief engineer review).

  Fixes two pre-launch vulnerabilities found in the schema/RLS/RPC review:

  1. Admin self-escalation: handle_new_user() trusted a client-controlled
     `role` field from auth.signUp()'s user metadata (raw_user_meta_data),
     which any caller can set. Anyone could sign up with
     `options: { data: { role: 'admin' } }` and receive a real admin
     profile. Fix: 'admin' is now only ever granted when it comes from
     raw_app_meta_data, which is exclusively settable server-side via the
     service-role Admin API (supabase.auth.admin.createUser({ app_metadata })).
     A public signUp() call can never write app_metadata, so it can never
     self-assign admin. See scripts/seed.mjs for the corresponding change.

  2. Opportunities IDOR: unlike every other mutable table (profiles,
     partner_profiles, projects, quotes), `opportunities` had no trigger
     guarding its identity columns. opportunities_update_own's WITH CHECK
     only constrained partner_id, not project_id — so a partner could PATCH
     their own opportunity row's project_id to an unrelated project and gain
     read/quote access to it, entirely bypassing distribute_opportunities()'s
     category matching. Separately, opportunities_answer's WITH CHECK never
     constrained partner_id at all, so a customer could reassign one of
     their opportunities to an arbitrary partner_id. Fix: a guard trigger,
     mirroring guard_quote_status/guard_project_status, that rejects any
     change to project_id/partner_id and scopes the remaining columns to
     the actor who is allowed to touch them (partner: status + question;
     customer: answer only).
*/

-- ---------------------------------------------------------------------------
-- 1. handle_new_user() — admin role only from raw_app_meta_data
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta        jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_app_meta    jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_role        text;
  v_full_name   text;
  v_partner_id  uuid;
  v_category    text;
BEGIN
  -- 'admin' is only trusted from app_metadata, which a public auth.signUp()
  -- call can never set — only the service-role Admin API can. Anything else
  -- (including a client-supplied role: 'admin' in user_metadata) is treated
  -- as an ordinary self-service signup and validated below.
  IF v_app_meta ->> 'role' = 'admin' THEN
    v_role := 'admin';
  ELSE
    v_role := coalesce(nullif(btrim(v_meta ->> 'role'), ''), 'customer');
    IF v_role NOT IN ('customer', 'partner') THEN
      RAISE EXCEPTION 'Unknown account type "%".', v_role;
    END IF;
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

-- ---------------------------------------------------------------------------
-- 2. opportunities — identity guard trigger
-- ---------------------------------------------------------------------------

/*
  SECURITY INVOKER on purpose, same reasoning as guard_project_status /
  guard_quote_status: SECURITY DEFINER RPCs run as their owner (current_user
  = 'postgres'), which steps aside here; a direct client UPDATE arrives as
  'authenticated' and is fully checked.

  Column scope by actor, inferred from the OLD row (before any tampering):
    - partner_id = my_partner_id() -> this is the matched partner acting via
      opportunities_update_own. They may change status/question, never answer.
    - owns_project(OLD.project_id) -> this is the project owner acting via
      opportunities_answer. They may change answer only, never status/question.
  project_id and partner_id themselves can never change through this path —
  only distribute_opportunities() (SECURITY DEFINER) creates these rows.
*/
CREATE OR REPLACE FUNCTION public.guard_opportunity_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_is_partner  boolean;
  v_is_customer boolean;
BEGIN
  IF current_user = 'postgres' OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'An opportunity cannot be moved to another project.';
  END IF;
  IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
    RAISE EXCEPTION 'An opportunity cannot be reassigned to another printing partner.';
  END IF;

  v_is_partner  := OLD.partner_id = my_partner_id();
  v_is_customer := owns_project(OLD.project_id);

  IF v_is_partner THEN
    IF NEW.answer IS DISTINCT FROM OLD.answer THEN
      RAISE EXCEPTION 'Only the customer can answer a clarification question.';
    END IF;
  ELSIF v_is_customer THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only the printing partner can update this opportunity''s status.';
    END IF;
    IF NEW.question IS DISTINCT FROM OLD.question THEN
      RAISE EXCEPTION 'Only the printing partner can ask a clarification question.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_opportunity_identity
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.guard_opportunity_identity();
