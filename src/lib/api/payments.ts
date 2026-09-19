import { supabase } from './client';
import type { Database } from './database.types';

export type BookingPaymentRow = Database['public']['Tables']['booking_payments']['Row'];
export type DesignPaymentRow = Database['public']['Tables']['design_payments']['Row'];

export async function getBookingPayment(orderId: string): Promise<BookingPaymentRow | null> {
  const { data, error } = await supabase.from('booking_payments').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDesignBookingPayment(orderId: string): Promise<DesignPaymentRow | null> {
  const { data, error } = await supabase.from('design_payments').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Calls the create-booking-checkout Edge Function; returns a URL to redirect the browser to. */
export async function createBookingCheckout(orderId: string): Promise<{ checkoutUrl: string; mock: boolean }> {
  const { data, error } = await supabase.functions.invoke('create-booking-checkout', {
    body: { order_id: orderId, kind: 'print' },
  });
  if (error) throw error;
  return data as { checkoutUrl: string; mock: boolean };
}

/** Same Edge Function, settling design_orders/design_payments instead — see its header comment. */
export async function createDesignBookingCheckout(orderId: string): Promise<{ checkoutUrl: string; mock: boolean }> {
  const { data, error } = await supabase.functions.invoke('create-booking-checkout', {
    body: { order_id: orderId, kind: 'design' },
  });
  if (error) throw error;
  return data as { checkoutUrl: string; mock: boolean };
}

/** Only reachable in PAYMONGO_MOCK=true deployments — the function itself refuses this outside mock mode. */
export async function completeMockPayment(
  providerCheckoutId: string,
  outcome: 'paid' | 'failed',
  kind: 'print' | 'design' = 'print',
): Promise<void> {
  const { error } = await supabase.functions.invoke('paymongo-webhook', {
    body: { mock: true, provider_checkout_id: providerCheckoutId, outcome, kind },
  });
  if (error) throw error;
}
