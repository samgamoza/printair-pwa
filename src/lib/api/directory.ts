import { supabase } from './client';
import type { Database } from './database.types';

export type PartnerDirectoryRow = Database['public']['Views']['partner_directory']['Row'];

export async function getPartnerDirectory(): Promise<PartnerDirectoryRow[]> {
  const { data, error } = await supabase.from('partner_directory').select('*').order('business_name');
  if (error) throw error;
  return data ?? [];
}

export async function getPartnerPublicProfile(partnerId: string): Promise<PartnerDirectoryRow | null> {
  const { data, error } = await supabase.from('partner_directory').select('*').eq('id', partnerId).maybeSingle();
  if (error) throw error;
  return data;
}

export type PrintCategory = Database['public']['Tables']['print_categories']['Row'];

export async function getCategories(): Promise<PrintCategory[]> {
  const { data, error } = await supabase.from('print_categories').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Designers — same shape as the partner directory above.
//
// The view already filters to status = 'active', so an application that is
// pending, rejected, or suspended can never appear here regardless of what the
// caller asks for. That is the whole point of the vetting gate being in the
// database rather than the query.
// ---------------------------------------------------------------------------

export type DesignerDirectoryRow = Database['public']['Views']['designer_directory']['Row'];

export async function getDesignerDirectory(): Promise<DesignerDirectoryRow[]> {
  const { data, error } = await supabase.from('designer_directory').select('*').order('display_name');
  if (error) throw error;
  return data ?? [];
}

export async function getDesignerPublicProfile(designerId: string): Promise<DesignerDirectoryRow | null> {
  const { data, error } = await supabase.from('designer_directory').select('*').eq('id', designerId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Portfolio samples for a public profile.
 *
 * Readable by anyone for an approved designer — designer_portfolio_public_read
 * allows it when the owning profile is active, which is exactly the set the
 * directory exposes.
 */
export async function getDesignerPublicPortfolio(designerId: string) {
  const { data, error } = await supabase
    .from('designer_portfolio_items')
    .select('*')
    .eq('designer_id', designerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
