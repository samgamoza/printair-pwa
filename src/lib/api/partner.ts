import { supabase } from './client';
import type { PartnerProfile } from './auth';

export async function updatePartnerProfile(
  partnerId: string,
  patch: Partial<
    Pick<
      PartnerProfile,
      | 'business_name'
      | 'contact_name'
      | 'city'
      | 'description'
      | 'typical_turnaround_days'
      | 'service_areas'
      | 'services'
      | 'logo_url'
      | 'portfolio_images'
    >
  >,
) {
  const { error } = await supabase.from('partner_profiles').update(patch).eq('id', partnerId);
  if (error) throw error;
}

export async function getPartnerCapabilities(partnerId: string): Promise<string[]> {
  const { data, error } = await supabase.from('partner_capabilities').select('category').eq('partner_id', partnerId);
  if (error) throw error;
  return (data ?? []).map((c) => c.category);
}

export async function setPartnerCapabilities(partnerId: string, categories: string[]) {
  const current = await getPartnerCapabilities(partnerId);
  const toAdd = categories.filter((c) => !current.includes(c));
  const toRemove = current.filter((c) => !categories.includes(c));

  if (toAdd.length) {
    const { error } = await supabase
      .from('partner_capabilities')
      .insert(toAdd.map((category) => ({ partner_id: partnerId, category })));
    if (error) throw error;
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from('partner_capabilities')
      .delete()
      .eq('partner_id', partnerId)
      .in('category', toRemove);
    if (error) throw error;
  }
}

/** True once the fields that meaningfully improve matching/trust are filled in. */
export function isProfileComplete(profile: PartnerProfile, capabilities: string[]): boolean {
  return Boolean(
    profile.description?.trim() &&
      profile.typical_turnaround_days &&
      capabilities.length > 0 &&
      profile.service_areas.length > 0,
  );
}
