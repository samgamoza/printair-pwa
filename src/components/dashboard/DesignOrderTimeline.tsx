import { DESIGN_ORDER_STAGES, type DesignOrderStageStatus } from '@/lib/validation';
import type { DesignOrderStatusEventRow } from '@/lib/api/designOrders';
import { Timeline } from '@/components/ui/Timeline';

const STAGE_LABELS: Record<DesignOrderStageStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  DELIVERED: 'Delivered',
};

/** Mirrors OrderTimeline, minus the READY stage — a design deliverable has no physical pickup step. */
export function DesignOrderTimeline({
  currentStatus,
  events,
}: {
  currentStatus: DesignOrderStageStatus;
  events: DesignOrderStatusEventRow[];
}) {
  return (
    <Timeline stages={DESIGN_ORDER_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }))} currentKey={currentStatus} events={events} />
  );
}
