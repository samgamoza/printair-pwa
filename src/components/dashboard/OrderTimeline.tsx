import { ORDER_STAGES, type OrderStatus } from '@/lib/validation';
import type { OrderStatusEventRow } from '@/lib/api/orders';
import { Timeline } from '@/components/ui/Timeline';

const STAGE_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  IN_PRODUCTION: 'In production',
  READY: 'Ready',
  DELIVERED: 'Delivered',
};

export function OrderTimeline({ currentStatus, events }: { currentStatus: OrderStatus; events: OrderStatusEventRow[] }) {
  return <Timeline stages={ORDER_STAGES.map((key) => ({ key, label: STAGE_LABELS[key] }))} currentKey={currentStatus} events={events} />;
}
