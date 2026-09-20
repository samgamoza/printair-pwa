/*
  PrintAir — high-severity hardening (2026-08-06 chief engineer review).

  1. Business-record FKs: customer_id/partner_id on projects, orders,
     reviews, and quotes were ON DELETE CASCADE from profiles/
     partner_profiles. Deleting a user's auth.users row (GDPR request, admin
     cleanup) silently destroyed the *other* party's completed orders and
     reviews. Switched to ON DELETE RESTRICT — an account with transaction
     history can no longer be hard-deleted; use profiles.status='suspended'
     instead. projects.customer_id is restricted rather than cascaded so the
     whole downstream subtree (project_files, opportunities, quotes, orders,
     reviews reachable via project_id) is protected at its first hop, not
     patched table-by-table.

     Constraint names are looked up dynamically (not hardcoded) since this
     migration never ran against a live instance before being written.

  2. Every SECURITY DEFINER RPC and RLS helper function relied solely on its
     own internal checks to stay safe, because PostgreSQL grants EXECUTE to
     PUBLIC by default at CREATE FUNCTION time and this migration's
     predecessors never revoked it. Not exploitable today (every function
     guards itself), but it removes the grant layer as a second line of
     defense. Revoked from PUBLIC and re-granted explicitly, matching the
     pattern email_exists() already used. is_admin() alone stays available to
     `anon` because two anon-facing policies (partner_profiles_public_read,
     reviews_public_read) call it in their USING clause; every other helper
     and RPC here is authenticated-only.

  3. Two missing indexes flagged in review: admin_audit_log had none beyond
     its primary key, and reviews.customer_id had none (only partner_id and
     the unique order_id were indexed).
*/

-- ---------------------------------------------------------------------------
-- 1. Business-record FKs: CASCADE -> RESTRICT
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_row     record;
  v_conname text;
BEGIN
  FOR v_row IN
    SELECT * FROM (VALUES
      ('projects', 'customer_id', 'profiles',         'projects_customer_id_fkey'),
      ('orders',   'customer_id', 'profiles',         'orders_customer_id_fkey'),
      ('orders',   'partner_id',  'partner_profiles',  'orders_partner_id_fkey'),
      ('reviews',  'customer_id', 'profiles',         'reviews_customer_id_fkey'),
      ('reviews',  'partner_id',  'partner_profiles',  'reviews_partner_id_fkey'),
      ('quotes',   'partner_id',  'partner_profiles',  'quotes_partner_id_fkey')
    ) AS t(tbl, col, ref_tbl, new_name)
  LOOP
    SELECT tc.constraint_name INTO v_conname
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = v_row.tbl
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = v_row.col;

    IF v_conname IS NULL THEN
      RAISE EXCEPTION 'Could not find an existing FK constraint on %.% — schema has drifted from what this migration expects.', v_row.tbl, v_row.col;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_row.tbl, v_conname);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE RESTRICT',
      v_row.tbl, v_row.new_name, v_row.col, v_row.ref_tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Function grants — revoke PUBLIC's default EXECUTE, re-grant explicitly
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.my_role()                                        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin()                                       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_partner_id()                                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_active()                                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_project(uuid)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_editable_project(uuid)                      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_has_opportunity(uuid)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_has_order(uuid)                          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_quote_on(uuid)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_order(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.order_stage_rank(text)                           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_project(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_project(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_quote(uuid)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_quote(uuid)                             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.select_quote(uuid)                               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_order_status(uuid, text, text)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_review(uuid, int, text, boolean)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text, text)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_moderate_review(uuid, boolean, text)       FROM PUBLIC;

-- Called from two anon-facing RLS policies (partner_profiles_public_read,
-- reviews_public_read), so anon needs it too — every other helper/RPC below
-- is only ever reached through an `authenticated`-only policy or client call.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.my_role(),
  public.my_partner_id(),
  public.assert_active(),
  public.owns_project(uuid),
  public.owns_editable_project(uuid),
  public.partner_has_opportunity(uuid),
  public.partner_has_order(uuid),
  public.can_quote_on(uuid),
  public.can_read_order(uuid),
  public.order_stage_rank(text),
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
-- 3. Missing indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor  ON admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log (target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer        ON reviews (customer_id);
