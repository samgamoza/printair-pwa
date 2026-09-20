/**
 * Drains the notification outbox.
 *
 * Claims a batch of PENDING rows, renders each, sends it through Resend, and
 * records the result. Designed to be run repeatedly on a schedule — anything it
 * fails to send stays PENDING and is retried on the next pass, up to a cap.
 *
 * verify_jwt is false (see config.toml): the caller is a scheduler, not a
 * signed-in user, so there is no Supabase JWT to present. It authenticates with
 * a shared secret instead, the same shape as the PayMongo webhook.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORS_HEADERS, jsonResponse } from '../_shared/cors.ts';
import { sendEmail, ResendNotConfigured, ResendPermanentError } from '../_shared/resend.ts';
import { render, type NotificationKind } from '../_shared/notification-templates.ts';

/** Give up after this many tries so one poison row cannot block the queue. */
const MAX_ATTEMPTS = 5;
/** Bounded so a backlog cannot exceed the function's wall-clock limit. */
const BATCH_SIZE = 25;

type NotificationRow = {
  id: string;
  recipient_id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  attempts: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const expected = Deno.env.get('NOTIFY_DISPATCH_SECRET');
  if (!expected) {
    return jsonResponse({ error: 'NOTIFY_DISPATCH_SECRET is not configured.' }, 500);
  }
  if (req.headers.get('x-dispatch-secret') !== expected) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // Service role: the dispatcher acts for no user, and RLS on notifications
    // deliberately grants nobody the ability to read another person's row.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const siteUrl = Deno.env.get('SITE_URL') ?? 'https://printair.guma.one';

  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, recipient_id, kind, payload, attempts')
    .eq('status', 'PENDING')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!pending?.length) return jsonResponse({ claimed: 0, sent: 0, failed: 0 });

  // Resolve recipients in one query rather than per row.
  const ids = [...new Set(pending.map((n) => n.recipient_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, status')
    .in('id', ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending as NotificationRow[]) {
    const profile = byId.get(row.recipient_id);

    // No address, or a suspended account: there is nothing to retry towards.
    // SKIPPED distinguishes "deliberately not sent" from "tried and failed".
    if (!profile?.email || profile.status !== 'active') {
      await supabase
        .from('notifications')
        .update({
          status: 'SKIPPED',
          last_error: !profile?.email ? 'no email on profile' : `profile status ${profile.status}`,
        })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    try {
      const msg = render(row.kind, row.payload ?? {}, siteUrl);
      await sendEmail({ to: profile.email, subject: msg.subject, html: msg.html, text: msg.text });
      await supabase
        .from('notifications')
        .update({ status: 'SENT', sent_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null })
        .eq('id', row.id);
      sent++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const message = e instanceof Error ? e.message : String(e);

      // A missing key or an unverified domain will fail identically forever.
      // Mark it terminal so the queue reflects reality instead of grinding
      // through five attempts per row against a misconfiguration.
      const terminal =
        e instanceof ResendPermanentError ||
        e instanceof ResendNotConfigured ||
        attempts >= MAX_ATTEMPTS;

      await supabase
        .from('notifications')
        .update({ status: terminal ? 'FAILED' : 'PENDING', attempts, last_error: message })
        .eq('id', row.id);
      failed++;
    }
  }

  return jsonResponse({ claimed: pending.length, sent, failed, skipped });
});
