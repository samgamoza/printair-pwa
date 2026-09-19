import { supabase } from './client';
import type { Database } from './database.types';

export type DesignOrderRow = Database['public']['Tables']['design_orders']['Row'];
export type DesignOrderStatusEventRow = Database['public']['Tables']['design_order_status_events']['Row'];
export type DesignOrderStatus = DesignOrderRow['status'];

export async function selectDesignProposal(proposalId: string): Promise<DesignOrderRow> {
  const { data, error } = await supabase.rpc('select_design_proposal', { p_proposal_id: proposalId }).single();
  if (error) throw error;
  return data as DesignOrderRow;
}

export async function updateDesignOrderStatus(orderId: string, status: DesignOrderStatus, note?: string): Promise<DesignOrderRow> {
  const { data, error } = await supabase
    .rpc('update_design_order_status', { p_order_id: orderId, p_status: status, p_note: note })
    .single();
  if (error) throw error;
  return data as DesignOrderRow;
}

export async function getDesignOrderByRequest(requestId: string): Promise<DesignOrderRow | null> {
  const { data, error } = await supabase.from('design_orders').select('*').eq('request_id', requestId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDesignOrderDetails(orderId: string): Promise<DesignOrderRow | null> {
  const { data, error } = await supabase.from('design_orders').select('*').eq('id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDesignOrderEvents(orderId: string): Promise<DesignOrderStatusEventRow[]> {
  const { data, error } = await supabase
    .from('design_order_status_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type DesignerOrder = DesignOrderRow & { request: Database['public']['Tables']['design_requests']['Row'] };

export async function getDesignerOrders(designerId: string): Promise<DesignerOrder[]> {
  const { data, error } = await supabase
    .from('design_orders')
    .select('*, request:design_requests(*)')
    .eq('designer_id', designerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DesignerOrder[];
}
