import { supabase } from './client';
import type { Database } from './database.types';

export type DesignProposalRow = Database['public']['Tables']['design_proposals']['Row'];

export type DesignProposalWithDesigner = DesignProposalRow & {
  designer: {
    id: string;
    display_name: string;
    city: string;
  } | null;
};

/** Mirrors createQuoteDraft — a bare DRAFT row a designer then fills in via updateProposal. */
export async function createProposalDraft(input: {
  requestId: string;
  designerId: string;
}): Promise<DesignProposalRow> {
  const { data, error } = await supabase
    .from('design_proposals')
    .insert({ request_id: input.requestId, designer_id: input.designerId, status: 'DRAFT' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type ProposalFields = {
  price?: number | null;
  downPaymentPct?: number | null;
  turnaroundDays?: number | null;
  revisionRoundsIncluded?: number;
  note?: string | null;
  validUntil?: string | null;
};

export async function updateProposal(id: string, fields: ProposalFields): Promise<DesignProposalRow> {
  const { data, error } = await supabase
    .from('design_proposals')
    .update({
      price: fields.price,
      down_payment_pct: fields.downPaymentPct,
      turnaround_days: fields.turnaroundDays,
      revision_rounds_included: fields.revisionRoundsIncluded,
      note: fields.note,
      valid_until: fields.validUntil,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitProposal(id: string): Promise<DesignProposalRow> {
  const { data, error } = await supabase.rpc('submit_design_proposal', { p_proposal_id: id }).single();
  if (error) throw error;
  return data as DesignProposalRow;
}

export async function withdrawProposal(id: string): Promise<DesignProposalRow> {
  const { data, error } = await supabase.rpc('withdraw_design_proposal', { p_proposal_id: id }).single();
  if (error) throw error;
  return data as DesignProposalRow;
}

/** All proposals on a request — RLS decides whether that's "all submitted, comparison-ready" (customer) or "mine only" (designer). */
export async function getRequestProposals(requestId: string): Promise<DesignProposalWithDesigner[]> {
  const { data, error } = await supabase
    .from('design_proposals')
    .select('*, designer:designer_profiles(id, display_name, city)')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DesignProposalWithDesigner[];
}

export async function getMyProposal(requestId: string, designerId: string): Promise<DesignProposalRow | null> {
  const { data, error } = await supabase
    .from('design_proposals')
    .select('*')
    .eq('request_id', requestId)
    .eq('designer_id', designerId)
    .in('status', ['DRAFT', 'SUBMITTED', 'SELECTED'])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type DesignProposalWithRequest = DesignProposalRow & { request: Database['public']['Tables']['design_requests']['Row'] };

export async function getDesignerProposals(designerId: string): Promise<DesignProposalWithRequest[]> {
  const { data, error } = await supabase
    .from('design_proposals')
    // Same PostgREST ambiguity as getPartnerQuotes: design_proposals<->design_requests has
    // two FK paths (design_proposals.request_id, and design_requests.selected_proposal_id
    // pointing back), so the constraint must be named explicitly.
    .select('*, request:design_requests!design_proposals_request_id_fkey(*)')
    .eq('designer_id', designerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DesignProposalWithRequest[];
}
