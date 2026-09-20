/*
  PrintAir — notification outbox.

  The marketplace's core promise is "partners respond with quotations", but
  until now nothing told either side that anything had happened. A partner
  learned about an opportunity only by logging in and looking; a customer
  learned a quote had arrived the same way. Someone who submitted a project and
  closed the tab never found out.

  This migration records the events. It deliberately does *not* send anything.

  Why an outbox rather than calling an email API from the trigger:

    * A trigger that makes an HTTP call ties the customer's transaction to a
      third party being up. Submitting a project must not fail because an email
      provider is slow.
    * Delivery becomes retryable and auditable — a failed send is a row with an
      error on it, not a message that silently never arrived.
    * It is provider-agnostic. Rows accumulate correctly before any email
      provider exists, so the events are never lost while that decision is
      pending, and an in-app notification list can read the same table.

  A separate sender drains PENDING rows. Nothing here depends on it existing.
*/

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who should hear about this. profiles, not auth.users: the sender needs the
  -- email and name, and cascading with the profile is the behaviour we want.
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN (
                 'OPPORTUNITY_RECEIVED',   -- partner: a project matched your capabilities
                 'QUOTE_RECEIVED',         -- customer: a partner quoted your project
                 'QUOTE_SELECTED',         -- partner: the customer chose you
                 'ORDER_STATUS_CHANGED',   -- customer: production moved on
                 'PAYMENT_CONFIRMED'       -- both: platform fee settled
               )),
  -- Everything the sender needs to render a message without re-querying:
  -- project title, partner name, amounts, and a deep link.
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  attempts     int NOT NULL DEFAULT 0,
  last_error   text,
  -- Set when the recipient has seen it in-app; independent of email delivery.
  read_at      timestamptz,
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The sender's hot path: oldest pending first, with a cap on retries.
CREATE INDEX notifications_pending_idx
  ON notifications (created_at)
  WHERE status = 'PENDING';

-- The in-app list: a recipient's unread items, newest first.
CREATE INDEX notifications_recipient_idx
  ON notifications (recipient_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Access
--
-- Recipients may read their own notifications and mark them read. Nobody may
-- INSERT from the client: rows are written only by the SECURITY DEFINER
-- triggers below, so a notification cannot be forged to make a message appear
-- to come from PrintAir.
-- ---------------------------------------------------------------------------

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON notifications TO authenticated;

CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.is_admin());

/*
  UPDATE is granted so a recipient can mark an item read. The WITH CHECK keeps
  the row theirs; it does not stop them writing other columns, so the client API
  updates only read_at. Tightening that further needs a column-level grant,
  which is the follow-up if this is ever more than a read flag.
*/
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Event capture
-- ---------------------------------------------------------------------------

/*
  A partner's opportunity row was just created by distribute_opportunities().
  One notification per partner, addressed to the user behind the partner
  profile.
*/
CREATE OR REPLACE FUNCTION public.notify_opportunity_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_project projects%ROWTYPE;
BEGIN
  SELECT pp.user_id INTO v_user_id
  FROM partner_profiles pp WHERE pp.id = NEW.partner_id;

  SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;

  IF v_user_id IS NULL OR v_project.id IS NULL THEN
    RETURN NEW;  -- nothing to address it to; never block the fan-out
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_user_id,
    'OPPORTUNITY_RECEIVED',
    jsonb_build_object(
      'opportunity_id', NEW.id,
      'project_id',     v_project.id,
      'project_title',  v_project.title,
      'category',       v_project.category,
      'path',           '/partner/opportunities/' || NEW.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifications are a side effect, never a gate. These triggers run inside
  -- the customer's or partner's own transaction, so an error raised here would
  -- roll back the thing that caused it — a project would fail to open for
  -- quotes because a notification could not be written. Losing a notification
  -- is recoverable; blocking commerce is not. The warning surfaces in Postgres
  -- logs so a genuine bug is still visible.
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_opportunity_received
  AFTER INSERT ON opportunities
  FOR EACH ROW EXECUTE FUNCTION public.notify_opportunity_received();

/*
  A quote reached the customer. Fires on the transition into SUBMITTED rather
  than on INSERT, because quotes are drafted first — a partner still editing a
  draft should not be emailing the customer on every keystroke.
*/
CREATE OR REPLACE FUNCTION public.notify_quote_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project projects%ROWTYPE;
  v_partner_name text;
BEGIN
  IF NEW.status <> 'SUBMITTED' OR OLD.status IS NOT DISTINCT FROM 'SUBMITTED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;
  SELECT pp.business_name INTO v_partner_name
  FROM partner_profiles pp WHERE pp.id = NEW.partner_id;

  IF v_project.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_project.customer_id,
    'QUOTE_RECEIVED',
    jsonb_build_object(
      'quote_id',      NEW.id,
      'project_id',    v_project.id,
      'project_title', v_project.title,
      'partner_name',  v_partner_name,
      'total_price',   NEW.total_price,
      'path',          '/dashboard/projects/' || v_project.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifications are a side effect, never a gate. These triggers run inside
  -- the customer's or partner's own transaction, so an error raised here would
  -- roll back the thing that caused it — a project would fail to open for
  -- quotes because a notification could not be written. Losing a notification
  -- is recoverable; blocking commerce is not. The warning surfaces in Postgres
  -- logs so a genuine bug is still visible.
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_quote_received
  AFTER UPDATE OF status ON quotes
  FOR EACH ROW EXECUTE FUNCTION public.notify_quote_received();

/*
  The customer picked a partner. select_quote() sets the winning quote to
  SELECTED; that partner should hear about it immediately.
*/
CREATE OR REPLACE FUNCTION public.notify_quote_selected() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_project projects%ROWTYPE;
BEGIN
  IF NEW.status <> 'SELECTED' OR OLD.status IS NOT DISTINCT FROM 'SELECTED' THEN
    RETURN NEW;
  END IF;

  SELECT pp.user_id INTO v_user_id
  FROM partner_profiles pp WHERE pp.id = NEW.partner_id;
  SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_user_id,
    'QUOTE_SELECTED',
    jsonb_build_object(
      'quote_id',      NEW.id,
      'project_id',    v_project.id,
      'project_title', v_project.title,
      'total_price',   NEW.total_price,
      'path',          '/partner/orders'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifications are a side effect, never a gate. These triggers run inside
  -- the customer's or partner's own transaction, so an error raised here would
  -- roll back the thing that caused it — a project would fail to open for
  -- quotes because a notification could not be written. Losing a notification
  -- is recoverable; blocking commerce is not. The warning surfaces in Postgres
  -- logs so a genuine bug is still visible.
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_quote_selected
  AFTER UPDATE OF status ON quotes
  FOR EACH ROW EXECUTE FUNCTION public.notify_quote_selected();

/*
  Production moved. The customer is told; the partner already knows, since they
  are the one who advanced it.
*/
CREATE OR REPLACE FUNCTION public.notify_order_status_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_title text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT p.title INTO v_project_title FROM projects p WHERE p.id = NEW.project_id;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    NEW.customer_id,
    CASE WHEN NEW.status = 'CONFIRMED' AND OLD.status = 'AWAITING_PAYMENT'
         THEN 'PAYMENT_CONFIRMED' ELSE 'ORDER_STATUS_CHANGED' END,
    jsonb_build_object(
      'order_id',      NEW.id,
      'project_id',    NEW.project_id,
      'project_title', v_project_title,
      'from_status',   OLD.status,
      'to_status',     NEW.status,
      'path',          '/dashboard/orders/' || NEW.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifications are a side effect, never a gate. These triggers run inside
  -- the customer's or partner's own transaction, so an error raised here would
  -- roll back the thing that caused it — a project would fail to open for
  -- quotes because a notification could not be written. Losing a notification
  -- is recoverable; blocking commerce is not. The warning surfaces in Postgres
  -- logs so a genuine bug is still visible.
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_status_changed
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_changed();
