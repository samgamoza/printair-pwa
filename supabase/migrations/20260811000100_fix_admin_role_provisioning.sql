/*
  PrintAir — make admin provisioning actually work.

  handle_new_user() only trusts an 'admin' role from raw_app_meta_data, which
  is correct and must stay: app_metadata is the one field a public
  auth.signUp() can never set, which is what closed the self-escalation hole in
  20260806000100_critical_security_patch.sql.

  The gap is timing, not trust. GoTrue's Admin API does not insert a user with
  app_metadata already populated — it INSERTs the row and then UPDATEs it to
  attach app_metadata. handle_new_user() is an AFTER INSERT trigger, so it runs
  against an empty app_metadata and falls through to the 'customer' default.
  The user ends up with raw_app_meta_data.role = 'admin' and profiles.role =
  'customer'.

  Net effect: no admin account could be created at all, including by
  scripts/seed.mjs, which does exactly what the Admin API documents. Verified
  by creating a user through /auth/v1/admin/users and observing
  profiles.role = 'customer' alongside raw_app_meta_data.role = 'admin', with
  auth.users.updated_at already ahead of created_at.

  This closes it by also reacting to the UPDATE. Trusting app_metadata on
  UPDATE is exactly as safe as trusting it on INSERT — the column is
  service-role-only either way, which is the entire premise of the original
  patch.

  Promotion only, deliberately. Clearing app_metadata does not demote an
  existing admin: an accidental metadata edit silently stripping admin rights
  is a worse failure than a stale one, and there is already a deliberate path
  for removing access (admin_set_account_status suspends the account).
*/

CREATE OR REPLACE FUNCTION public.sync_admin_role_from_app_metadata() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.raw_app_meta_data ->> 'role', '') = 'admin'
     AND coalesce(OLD.raw_app_meta_data ->> 'role', '') IS DISTINCT FROM 'admin'
  THEN
    -- SECURITY DEFINER, so current_user is 'postgres' here and
    -- guard_profile_privileges() steps aside as it does for every RPC.
    UPDATE profiles SET role = 'admin' WHERE id = NEW.id AND role <> 'admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_app_metadata_changed
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role_from_app_metadata();

-- Backfill anyone already stranded by this: app_metadata says admin, profile
-- does not. On a fresh database this matches nothing.
UPDATE profiles p
   SET role = 'admin'
  FROM auth.users u
 WHERE u.id = p.id
   AND u.raw_app_meta_data ->> 'role' = 'admin'
   AND p.role <> 'admin';
