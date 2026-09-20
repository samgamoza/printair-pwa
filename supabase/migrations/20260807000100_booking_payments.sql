/*
  PrintAir — booking-fee payments (Feature 1 of the marketplace-completeness plan).

  Monetization model chosen: PrintAir charges the customer a small platform
  booking fee (percentage of the selected quote's total_price) to confirm an
  order. The print job itself is paid directly between customer and partner,
  off-platform — PrintAir never holds or disburses job money, which keeps
  this out of escrow/money-transmission territory for a first version.

  Flow:
    select_quote() -> order created as 'AWAITING_PAYMENT' (not 'CONFIRMED')
                       + a booking_payments row for the computed fee
    customer pays  -> a Supabase Edge Function creates a PayMongo checkout
                       session (or a mock one — see supabase/functions/)
    webhook fires  -> a Supabase Edge Function (service_role) marks the
                       booking_payments row 'paid' and flips the order to
                       'CONFIRMED', inserting the matching order_status_events
                       row itself (there is no client-callable RPC for this
                       transition — it is not something the browser can be
                       trusted to assert on its own, unlike the partner-driven
                       IN_PRODUCTION/READY/DELIVERED steps in update_order_status()).

  booking_payments has no client INSERT/UPDATE grant at all — every write
  comes from an Edge Function using the service_role key, which bypasses RLS
  and grants entirely. That is the intentional trust boundary: a browser can
  ask "create me a checkout session" but can never mark its own payment paid.
*/

-- ---------------------------------------------------------------------------
-- 1. Insert AWAITING_PAYMENT as the first order stage
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.order_stage_rank(p_status text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_status
    WHEN 'AWAITING_PAYMENT' THEN 1
    WHEN 'CONFIRMED'        THEN 2
    WHEN 'IN_PRODUCTION'    THEN 3
    WHEN 'READY'            THEN 4
    WHEN 'DELIVERED'        THEN 5
  END;
$$;

-- Widen the orders.status and order_status_events.status CHECK constraints to
-- allow the new value. Constraint names are looked up dynamically rather than
-- assumed, matching the approach in 20260806000200_hardening.sql.
DO $$
DECLARE
  v_row     record;
  v_conname text;
BEGIN
  FOR v_row IN
    SELECT * FROM (VALUES
      ('orders',              'status'),
      ('order_status_events', 'status')
    ) AS t(tbl, col)
  LOOP
    SELECT tc.constraint_name INTO v_conname
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = v_row.tbl
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = v_row.col;

    IF v_conname IS NULL THEN
      RAISE EXCEPTION 'Could not find an existing CHECK constraint on %.% — schema has drifted from what this migration expects.', v_row.tbl, v_row.col;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_row.tbl, v_conname);
  END LOOP;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('AWAITING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'));

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'AWAITING_PAYMENT';

ALTER TABLE order_status_events
  ADD CONSTRAINT order_status_events_status_check
  CHECK (status IN ('AWAITING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'));

-- ---------------------------------------------------------------------------
-- 2. Booking fee — single source of truth for the percentage
-- ---------------------------------------------------------------------------

/*
  A SQL constant rather than a settings table: this is a one-app MVP, not a
  multi-tenant platform with per-shop pricing, so a table would be a second
  place for the number to drift from the Edge Function that actually charges
  it. Mirrored (display-only, never trusted) in src/lib/pricing.ts.
*/
CREATE OR REPLACE FUNCTION public.booking_fee_pct() RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT 5.00;
$$;

-- ---------------------------------------------------------------------------
-- 3. booking_payments
-- ---------------------------------------------------------------------------

CREATE TABLE booking_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  amount                numeric(12,2) NOT NULL CHECK (amount > 0),
  currency              text NOT NULL DEFAULT 'PHP',
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  provider              text NOT NULL DEFAULT 'paymongo',
  provider_checkout_id  text,
  provider_payment_id   text,
  paid_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_payments_provider_checkout ON booking_payments (provider_checkout_id);

CREATE TRIGGER trg_booking_payments_updated
  BEFORE UPDATE ON booking_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;

-- Read-only to clients; every write is a service_role Edge Function call.
GRANT SELECT ON booking_payments TO authenticated;

CREATE POLICY booking_payments_select ON booking_payments
  FOR SELECT TO authenticated
  USING (can_read_order(order_id) OR is_admin());

-- ---------------------------------------------------------------------------
-- 4. select_quote() — order now opens AWAITING_PAYMENT, with a fee row
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.select_quote(p_quote_id uuid) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote   quotes;
  v_project projects;
  v_order   orders;
  v_fee     numeric(12,2);
BEGIN
  PERFORM assert_active();

  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That quotation no longer exists.';
  END IF;

  SELECT * INTO v_project FROM projects WHERE id = v_quote.project_id FOR UPDATE;
  IF v_project.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only choose a printing partner for your own project.';
  END IF;
  IF v_project.status <> 'OPEN_FOR_QUOTES' THEN
    RAISE EXCEPTION 'A printing partner has already been chosen for this project.';
  END IF;
  IF v_quote.status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'That quotation is no longer available to choose.';
  END IF;

  UPDATE quotes SET status = 'SELECTED' WHERE id = p_quote_id;
  UPDATE quotes SET status = 'NOT_SELECTED'
   WHERE project_id = v_project.id
     AND id <> p_quote_id
     AND status IN ('DRAFT', 'SUBMITTED');

  UPDATE projects
     SET status = 'PROVIDER_SELECTED', selected_quote_id = p_quote_id
   WHERE id = v_project.id;

  INSERT INTO orders (project_id, quote_id, customer_id, partner_id, status)
  VALUES (v_project.id, p_quote_id, v_project.customer_id, v_quote.partner_id, 'AWAITING_PAYMENT')
  RETURNING * INTO v_order;

  INSERT INTO order_status_events (order_id, status, note, created_by)
  VALUES (v_order.id, 'AWAITING_PAYMENT', 'Printing partner selected. Booking fee payment required to confirm.', auth.uid());

  v_fee := round(v_quote.total_price * booking_fee_pct() / 100, 2);
  INSERT INTO booking_payments (order_id, amount)
  VALUES (v_order.id, v_fee);

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. update_order_status() — a partner can no longer skip payment
--
-- Unchanged logic (forward-only via order_stage_rank), but partners must
-- never be able to advance an order out of AWAITING_PAYMENT themselves —
-- only the payment webhook (service_role, bypassing this RPC entirely) may
-- do that. Explicitly reject it here too, so the intent is enforced even if
-- a future refactor changes how the webhook confirms payment.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid, p_status text, p_note text DEFAULT NULL
) RETURNS orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order orders;
BEGIN
  PERFORM assert_active();

  IF order_stage_rank(p_status) IS NULL THEN
    RAISE EXCEPTION 'Unknown status "%".', p_status;
  END IF;
  IF p_status = 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'Orders cannot be moved back to awaiting payment.';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That project no longer exists.';
  END IF;
  IF v_order.partner_id IS DISTINCT FROM my_partner_id() THEN
    RAISE EXCEPTION 'Only the selected printing partner can update this project.';
  END IF;
  IF v_order.status = 'AWAITING_PAYMENT' THEN
    RAISE EXCEPTION 'This order is still awaiting the customer''s booking fee payment.';
  END IF;
  IF order_stage_rank(p_status) <= order_stage_rank(v_order.status) THEN
    RAISE EXCEPTION 'This project is already at "%" — status cannot move backwards.', v_order.status;
  END IF;

  UPDATE orders
     SET status = p_status,
         delivered_at = CASE WHEN p_status = 'DELIVERED' THEN now() ELSE delivered_at END
   WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_status_events (order_id, status, note, created_by)
  VALUES (p_order_id, p_status, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());

  UPDATE projects
     SET status = CASE p_status
                    WHEN 'IN_PRODUCTION' THEN 'IN_PROGRESS'
                    WHEN 'READY'         THEN 'READY'
                    WHEN 'DELIVERED'     THEN 'DELIVERED'
                    ELSE status
                  END
   WHERE id = v_order.project_id;

  RETURN v_order;
END;
$$;
