/*
  PrintAir — notification coverage for the designer marketplace.

  20260809000100_notifications.sql predates the designer half, so it captures
  only print-side events. The result is a marketplace that runs silently: an
  approved designer is never told a matching request arrived, a customer is
  never told a proposal came in, and neither side learns a revision was
  uploaded or sent back. Both parties had to keep logging in and looking —
  exactly the problem the outbox was built to solve for the print side.

  This adds the parallel events. Same discipline throughout:

    * SECURITY DEFINER triggers write the rows; clients still cannot INSERT.
    * Every trigger swallows its own errors with a WARNING. These run inside
      the user's transaction, so raising here would roll back the thing that
      caused the notification — a customer's proposal selection would fail
      because a notification could not be written. Losing a notification is
      recoverable; blocking commerce is not.
    * Status-transition triggers fire on the transition, not on every UPDATE,
      so a designer editing a draft proposal does not notify anyone.

  Nothing sends. send-notifications drains the same PENDING rows it already
  drains, and needs no change — these are new `kind` values in the same table.
*/

-- ---------------------------------------------------------------------------
-- 1. Widen notifications.kind
--
-- The CHECK was written inline in CREATE TABLE, so it carries an
-- auto-generated name. Looked up dynamically rather than assumed, matching
-- how 20260810000200 handled profiles.role.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT tc.constraint_name INTO v_conname
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'notifications'
    AND tc.constraint_type = 'CHECK'
    AND ccu.column_name = 'kind';

  IF v_conname IS NULL THEN
    RAISE EXCEPTION 'Could not find the existing CHECK constraint on notifications.kind — schema has drifted from what this migration expects.';
  END IF;

  EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', v_conname);
END $$;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN (
    -- print marketplace (unchanged)
    'OPPORTUNITY_RECEIVED',
    'QUOTE_RECEIVED',
    'QUOTE_SELECTED',
    'ORDER_STATUS_CHANGED',
    'PAYMENT_CONFIRMED',
    -- designer marketplace
    'DESIGN_OPPORTUNITY_RECEIVED',    -- designer: a request matched your specialties
    'DESIGN_PROPOSAL_RECEIVED',       -- customer: a designer proposed on your request
    'DESIGN_PROPOSAL_SELECTED',       -- designer: the customer chose you
    'DESIGN_ORDER_STATUS_CHANGED',    -- customer: the commission moved on
    'DESIGN_DELIVERABLE_SUBMITTED',   -- customer: a revision is waiting for review
    'DESIGN_REVISION_REQUESTED',      -- designer: the customer asked for changes
    'DESIGNER_APPLICATION_REVIEWED'   -- designer: your application was decided
  ));

-- ---------------------------------------------------------------------------
-- 2. Opportunity fan-out — mirrors notify_opportunity_received()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_design_opportunity_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_request design_requests%ROWTYPE;
BEGIN
  SELECT dp.user_id INTO v_user_id FROM designer_profiles dp WHERE dp.id = NEW.designer_id;
  SELECT * INTO v_request FROM design_requests WHERE id = NEW.request_id;

  IF v_user_id IS NULL OR v_request.id IS NULL THEN
    RETURN NEW;  -- nothing to address it to; never block the fan-out
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_user_id,
    'DESIGN_OPPORTUNITY_RECEIVED',
    jsonb_build_object(
      'opportunity_id', NEW.id,
      'request_id',     v_request.id,
      'request_title',  v_request.title,
      'specialty',      v_request.specialty,
      'path',           '/designer/opportunities/' || NEW.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_design_opportunity_received
  AFTER INSERT ON design_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_opportunity_received();

-- ---------------------------------------------------------------------------
-- 3. Proposal reached the customer — mirrors notify_quote_received()
--
-- Fires on the transition into SUBMITTED, not on INSERT: proposals are
-- drafted first, and a designer still editing should not notify anyone.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_design_proposal_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request       design_requests%ROWTYPE;
  v_designer_name text;
BEGIN
  IF NEW.status <> 'SUBMITTED' OR OLD.status = 'SUBMITTED' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_request FROM design_requests WHERE id = NEW.request_id;
  SELECT display_name INTO v_designer_name FROM designer_profiles WHERE id = NEW.designer_id;

  IF v_request.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_request.customer_id,
    'DESIGN_PROPOSAL_RECEIVED',
    jsonb_build_object(
      'proposal_id',   NEW.id,
      'request_id',    v_request.id,
      'request_title', v_request.title,
      'designer_name', v_designer_name,
      'price',         NEW.price,
      'path',          '/dashboard/designs/' || v_request.id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_design_proposal_received
  AFTER UPDATE OF status ON design_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_proposal_received();

-- ---------------------------------------------------------------------------
-- 4. Designer was chosen — mirrors notify_quote_selected()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_design_proposal_selected() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_request design_requests%ROWTYPE;
BEGIN
  IF NEW.status <> 'SELECTED' OR OLD.status = 'SELECTED' THEN
    RETURN NEW;
  END IF;

  SELECT dp.user_id INTO v_user_id FROM designer_profiles dp WHERE dp.id = NEW.designer_id;
  SELECT * INTO v_request FROM design_requests WHERE id = NEW.request_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_user_id,
    'DESIGN_PROPOSAL_SELECTED',
    jsonb_build_object(
      'proposal_id',   NEW.id,
      'request_id',    NEW.request_id,
      'request_title', v_request.title,
      'price',         NEW.price,
      'path',          '/designer/orders'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_design_proposal_selected
  AFTER UPDATE OF status ON design_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_proposal_selected();

-- ---------------------------------------------------------------------------
-- 5. Commission moved on — mirrors notify_order_status_changed()
--
-- Addressed to the customer: the designer is the one driving the change, and
-- telling someone about their own action is noise.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_design_order_status_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request design_requests%ROWTYPE;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_request FROM design_requests WHERE id = NEW.request_id;

  /*
    Always DESIGN_ORDER_STATUS_CHANGED, including for CONFIRMED, rather than
    borrowing the print side's PAYMENT_CONFIRMED. That template says "your
    printing partner has been notified" and reads project_title — both wrong
    here. The design template special-cases CONFIRMED instead, keeping all
    design copy in one place.
  */
  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    NEW.customer_id,
    'DESIGN_ORDER_STATUS_CHANGED',
    jsonb_build_object(
      'order_id',      NEW.id,
      'request_id',    NEW.request_id,
      'request_title', v_request.title,
      'status',        NEW.status,
      'path',          '/dashboard/designs/' || NEW.request_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_design_order_status_changed
  AFTER UPDATE OF status ON design_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_order_status_changed();

-- ---------------------------------------------------------------------------
-- 6. Deliverables — the revision loop. No print-side equivalent to mirror.
--
-- Two directions, because both waits are real: the customer waiting on a
-- revision, and the designer waiting to hear whether it landed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_design_deliverable_submitted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order   design_orders%ROWTYPE;
  v_request design_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM design_orders WHERE id = NEW.order_id;
  IF v_order.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_request FROM design_requests WHERE id = v_order.request_id;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_order.customer_id,
    'DESIGN_DELIVERABLE_SUBMITTED',
    jsonb_build_object(
      'deliverable_id',  NEW.id,
      'order_id',        NEW.order_id,
      'request_id',      v_order.request_id,
      'request_title',   v_request.title,
      'revision_number', NEW.revision_number,
      'path',            '/dashboard/designs/' || v_order.request_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_design_deliverable_submitted
  AFTER INSERT ON design_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_deliverable_submitted();

/*
  The customer sent a revision back. Approval is deliberately not notified
  here — approving also moves the order to DELIVERED, and
  notify_design_order_status_changed() already covers that transition. Firing
  both would send the designer two messages about one action.
*/
CREATE OR REPLACE FUNCTION public.notify_design_revision_requested() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order   design_orders%ROWTYPE;
  v_user_id uuid;
  v_request design_requests%ROWTYPE;
BEGIN
  IF NEW.approved
     OR NEW.customer_feedback IS NULL
     OR NEW.customer_feedback IS NOT DISTINCT FROM OLD.customer_feedback THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order FROM design_orders WHERE id = NEW.order_id;
  SELECT dp.user_id INTO v_user_id FROM designer_profiles dp WHERE dp.id = v_order.designer_id;
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_request FROM design_requests WHERE id = v_order.request_id;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    v_user_id,
    'DESIGN_REVISION_REQUESTED',
    jsonb_build_object(
      'deliverable_id',  NEW.id,
      'order_id',        NEW.order_id,
      'request_title',   v_request.title,
      'revision_number', NEW.revision_number,
      'feedback',        NEW.customer_feedback,
      'path',            '/designer/orders'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_design_revision_requested
  AFTER UPDATE ON design_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.notify_design_revision_requested();

-- ---------------------------------------------------------------------------
-- 7. Application decided.
--
-- The one notification with no print-side analogue at all, and arguably the
-- most important: a designer sitting at pending_review has no work, no job
-- board, and until now no signal that anything ever happened. The landing page
-- promises "we will email you as soon as it is decided" — this is the row that
-- makes that true.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_designer_application_reviewed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = OLD.status OR OLD.status <> 'pending_review' THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (recipient_id, kind, payload)
  VALUES (
    NEW.user_id,
    'DESIGNER_APPLICATION_REVIEWED',
    jsonb_build_object(
      'designer_id',  NEW.id,
      'decision',     NEW.status,
      'reason',       NEW.review_reason,
      'display_name', NEW.display_name,
      'path',         '/designer'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notification trigger % failed: %', TG_NAME, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_designer_application_reviewed
  AFTER UPDATE OF status ON designer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_designer_application_reviewed();
