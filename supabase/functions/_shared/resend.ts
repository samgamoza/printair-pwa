/**
 * Minimal Resend client.
 *
 * Fail-closed like the PayMongo client: a missing key is a configuration error
 * we surface loudly rather than a silent no-op, because a notification that is
 * never sent and never complained about is the failure mode this whole feature
 * exists to remove.
 */

const RESEND_API = 'https://api.resend.com/emails';

export class ResendNotConfigured extends Error {
  constructor(missing: string) {
    super(`Resend is not configured: ${missing} is unset.`);
    this.name = 'ResendNotConfigured';
  }
}

/** Permanent failures must not be retried — the recipient will never accept. */
export class ResendPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResendPermanentError';
  }
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function resendConfig() {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFY_FROM');
  if (!apiKey) throw new ResendNotConfigured('RESEND_API_KEY');
  if (!from) throw new ResendNotConfigured('NOTIFY_FROM');
  return { apiKey, from };
}

export async function sendEmail(args: SendArgs): Promise<{ id: string }> {
  const { apiKey, from } = resendConfig();

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok) return { id: body.id ?? 'unknown' };

  const message = body?.message ?? body?.error ?? `HTTP ${res.status}`;

  // 4xx other than 429 means this message will never succeed: an unverified
  // sending domain, a malformed address, a revoked key. Retrying just burns
  // attempts and hides the real problem, so mark it terminal.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) {
    throw new ResendPermanentError(`${res.status}: ${message}`);
  }

  // 429 and 5xx are worth another go later.
  throw new Error(`${res.status}: ${message}`);
}
