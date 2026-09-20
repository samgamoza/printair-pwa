/*
  PayMongo client for Supabase Edge Functions (Deno).

  Mirrors the fail-closed discipline established for PrintAir's other
  external integrations (supabase/migrations/*.sql, scripts/seed.mjs): a
  missing secret must never mean "silently pretend it worked." Mock mode is
  opt-in only (PAYMONGO_MOCK=true) — without it, a missing PAYMONGO_SECRET_KEY
  throws rather than fabricating a checkout session.

  Request/response shapes verified against PayMongo's own API reference
  (docs.paymongo.com/reference/create_checkout_sessions,
  docs.paymongo.com/reference/checkout-session-resource) and cross-checked
  against the working signature-verification logic already in production at
  D:\All Apps\gumacommerce\packages\services\src\payments\paymongo.ts — same
  header format (`Paymongo-Signature: t=...,te=...,li=...`), same signed
  string (`${timestamp}.${payload}`), same HMAC-SHA256 algorithm, same
  5-minute replay window. Ported to Deno's Web Crypto API since Edge
  Functions don't have Node's `crypto` module.
*/

const PAYMONGO_API = "https://api.paymongo.com/v1";

export type PayMongoMode = "live" | "mock";

export interface CheckoutSessionInput {
  amountCentavos: number;
  description: string;
  referenceNumber: string;
  successUrl: string;
  cancelUrl: string;
  siteUrl: string;
  /** Which order/payments table this settles, carried through to the mock checkout URL. Defaults to 'print'. */
  mockKind?: "print" | "design";
}

export interface CheckoutSessionResult {
  id: string;
  checkoutUrl: string;
  mock?: boolean;
}

function isUsableSecret(secretKey: string | undefined): secretKey is string {
  if (!secretKey || !secretKey.trim()) return false;
  if (secretKey.startsWith("sk_test_xxx")) return false;
  if (secretKey === "sk_test_placeholder") return false;
  return true;
}

/** Fail-closed: throws unless a usable secret key or an explicit mock opt-in is present. */
export function resolvePayMongoMode(): PayMongoMode {
  const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  if (isUsableSecret(secretKey)) return "live";

  const mockAllowed = Deno.env.get("PAYMONGO_MOCK") === "true";
  if (mockAllowed) return "mock";

  throw new Error(
    "PayMongo is not configured: set PAYMONGO_SECRET_KEY for real payments, " +
      "or PAYMONGO_MOCK=true to use the local stub checkout flow.",
  );
}

export async function createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
  const mode = resolvePayMongoMode();

  if (mode === "mock") {
    const kindSuffix = input.mockKind === "design" ? "?kind=design" : "";
    return {
      id: `cs_mock_${crypto.randomUUID()}`,
      checkoutUrl: `${input.siteUrl}/checkout/mock/${input.referenceNumber}${kindSuffix}`,
      mock: true,
    };
  }

  const secretKey = Deno.env.get("PAYMONGO_SECRET_KEY")!;
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: "PrintAir platform fee",
              amount: input.amountCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: ["gcash", "paymaya", "card"],
          description: input.description,
          reference_number: input.referenceNumber,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: false,
          show_line_items: true,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`PayMongo create checkout session failed: ${await res.text()}`);
  }

  const json = (await res.json()) as { data: { id: string; attributes: { checkout_url: string } } };
  return { id: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish comparison — no early exit on mismatch, matching Node's timingSafeEqual intent. */
function fixedTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies a real PayMongo webhook. Header format: `t=<timestamp>,te=<test-mode
 * sig>,li=<live-mode sig>`. Signed string is `${timestamp}.${rawPayload}`,
 * HMAC-SHA256 hex-encoded. Rejects events older than 5 minutes (replay window).
 * A missing/empty secret always returns false — never "accept everything".
 */
export async function verifyWebhookSignature(
  rawPayload: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
): Promise<boolean> {
  if (!webhookSecret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [k, v] = part.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string | undefined>;

  const timestamp = parts["t"];
  const signature = parts["li"] || parts["te"] || parts["v1"];
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawPayload}`);
  return fixedTimeEqual(expected.toLowerCase(), signature.toLowerCase());
}
