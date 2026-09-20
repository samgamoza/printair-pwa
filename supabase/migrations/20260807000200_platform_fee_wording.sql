/*
  PrintAir — rename "booking fee" to "platform fee" in user-facing copy.

  In Philippine e-commerce/delivery apps, "booking fee" is closely
  associated with reserving a rider/courier (Lalamove, Grab, etc.) —
  PrintAir's fee has nothing to do with delivery, it's the platform's
  order-confirmation fee. "Platform fee" is the more standard, unambiguous
  term. No schema/behavior change — only the text stored in
  order_status_events.note and RAISE EXCEPTION messages that reach the UI.
  Internal identifiers (booking_payments table, booking_fee_pct() function,
  createBookingCheckout/getBookingPayment API functions) are intentionally
  left unchanged — users never see those names, renaming them would just be
  churn for no user-facing benefit.
*/

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
  VALUES (v_order.id, 'AWAITING_PAYMENT', 'Printing partner selected. Platform fee payment required to confirm.', auth.uid());

  v_fee := round(v_quote.total_price * booking_fee_pct() / 100, 2);
  INSERT INTO booking_payments (order_id, amount)
  VALUES (v_order.id, v_fee);

  RETURN v_order;
END;
$$;

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
    RAISE EXCEPTION 'This order is still awaiting the customer''s platform fee payment.';
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
