/*
  PrintAir — restrict the designer admin review queue to admins.

  designer_admin_review_queue was created WITH (security_invoker = false) and
  granted to `authenticated`. Those two together are the bug: the view runs as
  its owner, so RLS on designer_profiles never applies, and the grant let any
  signed-in user — an ordinary customer — read every pending designer
  application: display name, city, bio, and the free-text application note.

  Caught by a post-push check: an ordinary logged-in customer selecting from
  the view returned the pending applicant rather than nothing.

  security_invoker = false is kept deliberately, matching partner_directory:
  the flag counts aggregate designer_portfolio_items across applicants who are
  not yet 'active', which an invoker-rights view could not read. The caller is
  gated inside the view instead, with is_admin() — which reads auth.uid() from
  the request JWT and so still identifies the real caller even though the view
  executes as its owner.

  The grant stays on `authenticated` rather than being narrowed to an admin
  role, because Supabase authenticates every signed-in user as `authenticated`
  regardless of application role; there is no separate database role to grant
  to. is_admin() is the only real gate available, and is the same one every
  admin RPC already relies on.
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
WHERE dp.status = 'pending_review'
  AND public.is_admin();
