import { supabase } from './client';
import type { Database } from './database.types';

export type OpportunityRow = Database['public']['Tables']['opportunities']['Row'];

export type OpportunityWithProject = OpportunityRow & {
  project: Database['public']['Tables']['projects']['Row'];
};

/** New project opportunities matched to the signed-in partner's capabilities. */
export async function getPartnerOpportunities(partnerId: string): Promise<OpportunityWithProject[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*, project:projects(*)')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OpportunityWithProject[];
}

export async function getOpportunityDetails(id: string): Promise<OpportunityWithProject | null> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*, project:projects(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as OpportunityWithProject | null;
}

export async function markOpportunityViewed(id: string) {
  const { error } = await supabase.from('opportunities').update({ status: 'VIEWED' }).eq('id', id).eq('status', 'NEW');
  if (error) throw error;
}

export async function declineOpportunity(id: string) {
  const { error } = await supabase.from('opportunities').update({ status: 'DECLINED' }).eq('id', id);
  if (error) throw error;
}

export async function askClarificationQuestion(id: string, question: string) {
  const { error } = await supabase.from('opportunities').update({ question }).eq('id', id);
  if (error) throw error;
}

export async function answerClarificationQuestion(id: string, answer: string) {
  const { error } = await supabase.from('opportunities').update({ answer }).eq('id', id);
  if (error) throw error;
}

export type OpportunityQuestion = OpportunityRow & {
  partner: { id: string; business_name: string } | null;
};

/**
 * Clarification questions asked on the customer's own project.
 *
 * opportunities_select already lets the project owner read these, and
 * opportunities_answer lets them write `answer` (guard_opportunity_identity
 * scopes a customer to that column alone). The UI to use any of it was simply
 * never built, so partners asked questions into a void and the page told them
 * "waiting for the customer to reply" indefinitely.
 */
export async function getProjectQuestions(projectId: string): Promise<OpportunityQuestion[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*, partner:partner_profiles(id, business_name)')
    .eq('project_id', projectId)
    .not('question', 'is', null)
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OpportunityQuestion[];
}
