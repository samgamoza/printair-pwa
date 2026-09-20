/*
  PayMongo webhook receiver. verify_jwt = false in supabase/config.toml —
  PayMongo doesn't send a Supabase user JWT, it sends its own HMAC signature
  in the Paymongo-Signature header, verified below.

  Runs entirely as service_role: this is the one place in the app allowed to
  flip an order from AWAITING_PAYMENT to CONFIRMED, and it is not something
  the browser can be trusted to assert on its own (there is no client RPC for
  this transition — see supabase/migrations/20260807000100_booking_payments.sql).

  Settles either orders/booking_payments (print) or design_orders/design_payments
  (design) from the one checkout id, branching rather than duplicating this
  function — see the note in
  supabase/migrations/20260810000200_designer_marketplace_schema.sql section 9.
  A real PayMongo event carries no app-specific "kind" field, so a live
  checkout id is looked up in booking_payments first, then design_payments.
  The mock payload (sent by MockCheckoutPage) states its kind explicitly
  instead, since a mock checkout id is never looked up against PayMongo.

  Mock-mode bypass: when PAYMONGO_MOCK=true, a synthetic
  { mock: true, provider_checkout_id, outcome, kind? } payload (sent by
  src/pages/checkout/MockCheckoutPage.tsx) is accepted without signature
  verification. That payload shape is rejected outright whenever the server
  is NOT in mock mode — a mock payload can never fake a real payment in a
  real deployment.
*/
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { resolvePayMongoMode, verifyWebhookSignature } from "../_shared/paymongo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Outcome = "paid" | "failed";
type Kind = "print" | "design";

const TABLES: Record<Kind, { orders: string; payments: string; events: string; confirmedStatus: string; confirmedNote: string }> = {
  print: {
    orders: "orders",
    payments: "booking_payments",
    events: "order_status_events",
    confirmedStatus: "CONFIRMED",
    confirmedNote: "Platform fee received — order confirmed.",
  },
  design: {
    orders: "design_orders",
    payments: "design_payments",
    events: "design_order_status_events",
    confirmedStatus: "CONFIRMED",
    confirmedNote: "Platform fee received — order confirmed. The designer has been notified.",
  },
};

async function settle(kind: Kind, checkoutId: string, outcome: Outcome, providerPaymentId: string | null): Promise<boolean> {
  const { orders: ordersTable, payments: paymentsTable, events: eventsTable, confirmedStatus, confirmedNote } = TABLES[kind];
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: payment, error: paymentErr } = await serviceClient
    .from(paymentsTable)
    .select("id, order_id, status")
    .eq("provider_checkout_id", checkoutId)
    .maybeSingle();

  if (paymentErr) throw paymentErr;
  if (!payment) return false; // not this table's checkout id — caller tries the other kind
  if (payment.status === "paid") return true; // already processed — webhooks can be delivered more than once

  if (outcome === "paid") {
    const { error: payErr } = await serviceClient
      .from(paymentsTable)
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_payment_id: providerPaymentId })
      .eq("id", payment.id);
    if (payErr) throw payErr;

    const { data: order, error: orderErr } = await serviceClient
      .from(ordersTable)
      .update({ status: confirmedStatus })
      .eq("id", payment.order_id)
      .eq("status", "AWAITING_PAYMENT")
      .select("id")
      .maybeSingle();
    if (orderErr) throw orderErr;

    if (order) {
      const { error: eventErr } = await serviceClient.from(eventsTable).insert({
        order_id: payment.order_id,
        status: confirmedStatus,
        note: confirmedNote,
        created_by: null,
      });
      if (eventErr) throw eventErr;
    }
  } else {
    const { error: failErr } = await serviceClient.from(paymentsTable).update({ status: "failed" }).eq("id", payment.id);
    if (failErr) throw failErr;
  }

  return true;
}

/** Live events: try print first (the original, more common flow), then design. */
async function applyOutcome(checkoutId: string, outcome: Outcome, providerPaymentId: string | null, knownKind?: Kind) {
  if (knownKind) {
    const handled = await settle(knownKind, checkoutId, outcome, providerPaymentId);
    if (!handled) console.warn(`paymongo-webhook: no ${TABLES[knownKind].payments} row for checkout ${checkoutId}`);
    return;
  }
  if (await settle("print", checkoutId, outcome, providerPaymentId)) return;
  if (await settle("design", checkoutId, outcome, providerPaymentId)) return;
  // Not one of ours (or the checkout id was never recorded) — acknowledge so
  // PayMongo doesn't keep retrying something retrying can't fix.
  console.warn(`paymongo-webhook: no booking_payments or design_payments row for checkout ${checkoutId}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const rawBody = await req.text();

  try {
    const body = JSON.parse(rawBody);
    const mode = resolvePayMongoMode();

    if (body?.mock === true) {
      if (mode !== "mock") {
        return jsonResponse({ error: "Mock payloads are not accepted outside mock mode." }, 403);
      }
      const checkoutId = body.provider_checkout_id;
      const outcome: Outcome = body.outcome === "paid" ? "paid" : "failed";
      const kind: Kind = body.kind === "design" ? "design" : "print";
      if (!checkoutId) return jsonResponse({ error: "provider_checkout_id is required." }, 400);

      await applyOutcome(checkoutId, outcome, `mock_payment_${crypto.randomUUID()}`, kind);
      return jsonResponse({ ok: true });
    }

    const verified = await verifyWebhookSignature(
      rawBody,
      req.headers.get("Paymongo-Signature"),
      Deno.env.get("PAYMONGO_WEBHOOK_SECRET"),
    );
    if (!verified) return jsonResponse({ error: "Invalid webhook signature." }, 401);

    const eventType: string | undefined = body?.data?.attributes?.type;
    const resource = body?.data?.attributes?.data;
    const checkoutId: string | undefined = resource?.id;

    if (!checkoutId) return jsonResponse({ error: "No checkout session id in event payload." }, 400);

    if (eventType === "checkout_session.payment.paid") {
      const providerPaymentId: string | null = resource?.attributes?.payments?.[0]?.id ?? null;
      await applyOutcome(checkoutId, "paid", providerPaymentId);
    }
    // Other event types (expired sessions, failed payment attempts, etc.) are
    // acknowledged but not acted on for this MVP — the customer can always
    // retry checkout via create-booking-checkout, which issues a fresh session.

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("paymongo-webhook failed:", e);
    const message = e instanceof Error ? e.message : "Webhook processing failed.";
    return jsonResponse({ error: message }, 500);
  }
});
