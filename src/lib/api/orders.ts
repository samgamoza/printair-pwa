import { supabase } from './client';
import type { Database } from './database.types';

export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type OrderStatusEventRow = Database['public']['Tables']['order_status_events']['Row'];
export type OrderStatus = OrderRow['status'];

export async function selectQuote(quoteId: string): Promise<OrderRow> {
  const { data, error } = await supabase.rpc('select_quote', { p_quote_id: quoteId }).single();
  if (error) throw error;
  return data as OrderRow;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<OrderRow> {
  const { data, error } = await supabase
    .rpc('update_order_status', { p_order_id: orderId, p_status: status, p_note: note })
    .single();
  if (error) throw error;
  return data as OrderRow;
}

export async function getOrderByProject(projectId: string): Promise<OrderRow | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrderEvents(orderId: string): Promise<OrderStatusEventRow[]> {
  const { data, error } = await supabase
    .from('order_status_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type PartnerOrder = OrderRow & { project: Database['public']['Tables']['projects']['Row'] };

export async function getPartnerOrders(partnerId: string): Promise<PartnerOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, project:projects(*)')
    .eq('partner_id', partnerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PartnerOrder[];
}
