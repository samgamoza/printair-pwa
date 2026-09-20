/*
  PrintAir — run the notification dispatcher on a schedule.

  The outbox (20260809000100) records events and the send-notifications Edge
  Function drains them, but nothing was calling it, so rows sat PENDING forever.
  This schedules that call.

  Configuration lives in Vault rather than in this file, because the dispatch
  URL and shared secret must not be committed to git. The two entries are
  created out-of-band:

    select vault.create_secret('<url>',    'notify_dispatch_url');
    select vault.create_secret('<secret>', 'notify_dispatch_secret');

  Until they exist the job runs and no-ops with a warning, so applying this
  migration is safe in any environment — a local or preview database with no
  Vault entries simply does nothing rather than erroring every minute.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

/*
  Fires the dispatcher. Returns void and swallows configuration problems: this
  runs unattended once a minute, and a hard failure would only fill the cron
  log with identical errors. net.http_post is asynchronous — it queues the
  request and returns immediately, so the job never holds a worker open waiting
  on the function.
*/
CREATE OR REPLACE FUNCTION public.dispatch_notifications() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'notify_dispatch_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'notify_dispatch_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'dispatch_notifications: vault entries notify_dispatch_url / notify_dispatch_secret are not set; skipping.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-dispatch-secret', v_secret
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_notifications failed: %', SQLERRM;
END;
$$;

-- Nobody but the scheduler should be able to fire this.
REVOKE ALL ON FUNCTION public.dispatch_notifications() FROM PUBLIC;

/*
  Every minute. Notification volume is low and the function exits immediately
  when the outbox is empty, so the cost of a frequent poll is negligible next to
  the cost of a partner learning about an opportunity an hour late.

  Unscheduled first so re-running this migration replaces the job rather than
  accumulating duplicates.
*/
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-notification-outbox') THEN
    PERFORM cron.unschedule('drain-notification-outbox');
  END IF;

  PERFORM cron.schedule(
    'drain-notification-outbox',
    '* * * * *',
    'SELECT public.dispatch_notifications();'
  );
END $$;
