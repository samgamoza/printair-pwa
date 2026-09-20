/*
  PrintAir — make service_role's access explicit on the tables the Edge
  Functions write.

  Found by the designer integration suite: a service_role client is refused
  with "permission denied for table design_payments". Every migration so far
  has granted only to `anon` and `authenticated` and left service_role to
  Supabase's default privileges. Those defaults hold on a hosted project —
  the print-side payment path was smoke-tested end to end against one — but
  they do not hold on the local CLI stack, so the same code fails locally and
  passes hosted.

  That gap is worth closing rather than working around, because of what
  depends on it. paymongo-webhook is the *only* actor permitted to move an
  order out of AWAITING_PAYMENT (there is deliberately no client RPC for that
  transition). If its writes are refused, checkout completes, money moves, and
  the order silently never confirms — the customer has paid and nothing
  happens. Relying on an implicit default for that is the same class of
  mistake as F4 in the chief-engineer review, where state-changing RPCs were
  never REVOKE'd from PUBLIC because the default happened to be survivable.

  Scope is deliberately the tables the three Edge Functions actually touch,
  not a blanket grant across the schema: service_role bypasses RLS, so every
  table named here is a table where the only remaining protection is that
  nothing but a trusted server process holds the key.

    create-booking-checkout  reads  orders / design_orders
                             writes booking_payments / design_payments
    paymongo-webhook         writes booking_payments / design_payments
                                    orders / design_orders
                                    order_status_events / design_order_status_events
    send-notifications       reads  profiles
                             writes notifications
*/

-- Payment settlement — the webhook's core job.
GRANT SELECT, INSERT, UPDATE ON public.booking_payments          TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.design_payments           TO service_role;

-- The order transition the webhook alone is allowed to make.
GRANT SELECT, UPDATE         ON public.orders                    TO service_role;
GRANT SELECT, UPDATE         ON public.design_orders             TO service_role;

-- The audit trail it writes alongside that transition.
GRANT SELECT, INSERT         ON public.order_status_events        TO service_role;
GRANT SELECT, INSERT         ON public.design_order_status_events TO service_role;

-- Notification dispatch: read recipients, mark rows SENT/FAILED/SKIPPED.
GRANT SELECT                 ON public.profiles                   TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.notifications              TO service_role;

/*
  No DELETE anywhere on purpose. Nothing in the Edge Functions deletes, and a
  compromised service-role key should not be able to erase the payment record
  or the status history that proves what happened.
*/
