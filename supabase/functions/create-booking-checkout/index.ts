/*
  POST { order_id, kind? }
  kind: 'print' (default, backward-compatible) | 'design'.

  Auth: caller's JWT, forwarded to a user-scoped Supabase client so RLS
  decides whether they can even see the order — no separate authorization
  check needed beyond "does this row come back" plus the explicit
  customer_id match below (RLS' orders_select/design_orders_select also
  allows the partner/designer and admin to read the order, but only the
  customer may pay the platform fee).

  Creates (or recreates, if the previous attempt failed/expired) a PayMongo
  checkout session for the order's payment row and returns the checkout URL
  for the browser to redirect to.

  Branches on `kind` to settle either orders/booking_payments (print) or
  design_orders/design_payments (design) — same mechanic, same 5% platform
  fee, different tables — rather than duplicating this function. See the
  note in supabase/migrations/20260810000200_designer_marketplace_schema.sql
  section 9.
*/
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS, jsonResponse } from "../_shared/cors.ts";
import { createCheckoutSession } from "../_shared/paymongo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Kind = "print" | "design";

const TABLES: Record<Kind, { orders: string; payments: string; label: string }> = {
  print: { orders: "orders", payments: "booking_payments", label: "PrintAir platform fee" },
  design: { orders: "design_orders", payments: "design_payments", label: "PrintAir platform fee — design commission" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const { order_id, kind: rawKind } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return jsonResponse({ error: "order_id is required." }, 400);
    }
    const kind: Kind = rawKind === "design" ? "design" : "print";
    const { orders: ordersTable, payments: paymentsTable, label } = TABLES[kind];

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "You need to be signed in to do that." }, 401);

    // RLS-gated read: comes back only if this user is the customer, the
    // selected partner/designer, or an admin. The explicit check below
    // narrows that further to "only the customer may initiate their own
    // booking payment".
    const { data: order, error: orderErr } = await userClient
      .from(ordersTable)
      .select("id, customer_id, status")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) return jsonResponse({ error: "Order not found." }, 404);
    if (order.customer_id !== user.id) {
      return jsonResponse({ error: "Only the customer can pay this order's platform fee." }, 403);
    }
    if (order.status !== "AWAITING_PAYMENT") {
      return jsonResponse({ error: "This order is not awaiting a platform fee payment." }, 400);
    }

    // The payments table has no client write grant at all — service_role from
    // here on, for both the read (to get the authoritative amount) and the
    // write (to record the new checkout session id).
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: payment, error: paymentErr } = await serviceClient
      .from(paymentsTable)
      .select("id, amount, status")
      .eq("order_id", order_id)
      .single();

    if (paymentErr || !payment) return jsonResponse({ error: "No platform fee record found for this order." }, 404);
    if (payment.status === "paid") return jsonResponse({ error: "This platform fee has already been paid." }, 400);

    const siteUrl = Deno.env.get("SITE_URL");
    if (!siteUrl) throw new Error("SITE_URL is not configured for this Supabase project.");

    const returnSuffix = kind === "design" ? `&kind=design` : "";

    const session = await createCheckoutSession({
      amountCentavos: Math.round(Number(payment.amount) * 100),
      description: `${label} — order ${order_id.slice(0, 8)}`,
      // The mock checkout page needs to know which table to settle too, so the
      // kind rides along as a query param on the reference it's given — see
      // _shared/paymongo.ts' mock branch, which builds the mock URL from
      // referenceNumber alone. Passed separately here rather than folding into
      // referenceNumber, which PayMongo also uses verbatim as its own reference.
      referenceNumber: order_id,
      successUrl: `${siteUrl}/checkout/return?order=${order_id}${returnSuffix}`,
      cancelUrl: `${siteUrl}/checkout/return?order=${order_id}&cancelled=1${returnSuffix}`,
      siteUrl,
      mockKind: kind,
    });

    const { error: updateErr } = await serviceClient
      .from(paymentsTable)
      .update({ provider_checkout_id: session.id, status: "pending" })
      .eq("order_id", order_id);
    if (updateErr) throw updateErr;

    return jsonResponse({ checkoutUrl: session.checkoutUrl, mock: session.mock ?? false });
  } catch (e) {
    console.error("create-booking-checkout failed:", e);
    const message = e instanceof Error ? e.message : "Could not start checkout.";
    return jsonResponse({ error: message }, 500);
  }
});
