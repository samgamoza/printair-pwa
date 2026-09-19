import { supabase } from './client';
import type { Database } from './database.types';

export type QuoteRow = Database['public']['Tables']['quotes']['Row'];
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];

export type QuoteWithPartner = QuoteRow & {
  partner: {
    id: string;
    business_name: string;
    city: string;
  } | null;
};

export async function createQuoteDraft(input: {
  projectId: string;
  partnerId: string;
}): Promise<QuoteRow> {
  const { data, error } = await supabase
    .from('quotes')
    .insert({ project_id: input.projectId, partner_id: input.partnerId, status: 'DRAFT' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type QuoteFields = {
  totalPrice?: number | null;
  downPaymentPct?: number | null;
  turnaroundDays?: number | null;
  estimatedCompletion?: string | null;
  deliveryAvailable?: boolean;
  note?: string | null;
  validUntil?: string | null;
};

export async function updateQuote(id: string, fields: QuoteFields): Promise<QuoteRow> {
  const { data, error } = await supabase
    .from('quotes')
    .update({
      total_price: fields.totalPrice,
      down_payment_pct: fields.downPaymentPct,
      turnaround_days: fields.turnaroundDays,
      estimated_completion: fields.estimatedCompletion,
      delivery_available: fields.deliveryAvailable,
      note: fields.note,
      valid_until: fields.validUntil,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitQuote(id: string): Promise<QuoteRow> {
  const { data, error } = await supabase.rpc('submit_quote', { p_quote_id: id }).single();
  if (error) throw error;
  return data as QuoteRow;
}

export async function withdrawQuote(id: string): Promise<QuoteRow> {
  const { data, error } = await supabase.rpc('withdraw_quote', { p_quote_id: id }).single();
  if (error) throw error;
  return data as QuoteRow;
}

/** All quotations on a project — RLS decides whether that's "all, comparison-ready" (customer) or "mine only" (partner). */
export async function getProjectQuotes(projectId: string): Promise<QuoteWithPartner[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, partner:partner_profiles(id, business_name, city)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QuoteWithPartner[];
}

export async function getMyQuote(projectId: string, partnerId: string): Promise<QuoteRow | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('project_id', projectId)
    .eq('partner_id', partnerId)
    .in('status', ['DRAFT', 'SUBMITTED', 'SELECTED'])
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type QuoteWithProject = QuoteRow & { project: Database['public']['Tables']['projects']['Row'] };

export async function getPartnerQuotes(partnerId: string): Promise<QuoteWithProject[]> {
  const { data, error } = await supabase
    .from('quotes')
    // quotes<->projects has two FK paths (quotes.project_id, and projects.selected_quote_id
    // pointing back at quotes), so PostgREST can't infer which one to embed without a hint —
    // it returns 300 Multiple Choices otherwise. Name the constraint explicitly.
    .select('*, project:projects!quotes_project_id_fkey(*)')
    .eq('partner_id', partnerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as QuoteWithProject[];
}
