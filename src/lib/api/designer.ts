import { supabase } from './client';
import type { Database } from './database.types';

export type DesignOpportunityRow = Database['public']['Tables']['design_opportunities']['Row'];
export type DesignRequestRow = Database['public']['Tables']['design_requests']['Row'];
export type DesignerPortfolioItemRow = Database['public']['Tables']['designer_portfolio_items']['Row'];

export type DesignOpportunityWithRequest = DesignOpportunityRow & {
  request: DesignRequestRow;
};

/**
 * The job board: design requests matched to this designer's specialties.
 *
 * RLS already limits this to opportunities addressed to the caller, and the
 * fan-out trigger only creates them for approved designers — so a
 * pending_review designer gets an empty list here without the UI needing to
 * check. It checks anyway, to say something useful instead of showing an
 * empty board.
 */
export async function getDesignerOpportunities(
  designerId: string,
): Promise<DesignOpportunityWithRequest[]> {
  const { data, error } = await supabase
    .from('design_opportunities')
    .select('*, request:design_requests(*)')
    .eq('designer_id', designerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DesignOpportunityWithRequest[];
}

export async function getDesignOpportunity(id: string): Promise<DesignOpportunityWithRequest | null> {
  const { data, error } = await supabase
    .from('design_opportunities')
    .select('*, request:design_requests(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as DesignOpportunityWithRequest | null;
}

/** NEW -> VIEWED, so the job board's unread count reflects what has been read. */
export async function markDesignOpportunityViewed(id: string) {
  const { error } = await supabase
    .from('design_opportunities')
    .update({ status: 'VIEWED' })
    .eq('id', id)
    .eq('status', 'NEW');
  if (error) throw error;
}

export async function declineDesignOpportunity(id: string) {
  const { error } = await supabase.from('design_opportunities').update({ status: 'DECLINED' }).eq('id', id);
  if (error) throw error;
}

/** Mirrors askClarificationQuestion — one question per opportunity, enforced by guard_design_opportunity_identity(). */
export async function askDesignClarificationQuestion(id: string, question: string) {
  const { error } = await supabase.from('design_opportunities').update({ question }).eq('id', id);
  if (error) throw error;
}

/** The customer's side of that exchange. guard_design_opportunity_identity() scopes them to `answer`. */
export async function answerDesignClarificationQuestion(id: string, answer: string) {
  const { error } = await supabase.from('design_opportunities').update({ answer }).eq('id', id);
  if (error) throw error;
}

export type DesignOpportunityQuestion = DesignOpportunityRow & {
  designer: { id: string; display_name: string } | null;
};

/** Clarification questions asked on the customer's own design request. */
export async function getRequestQuestions(requestId: string): Promise<DesignOpportunityQuestion[]> {
  const { data, error } = await supabase
    .from('design_opportunities')
    .select('*, designer:designer_profiles(id, display_name)')
    .eq('request_id', requestId)
    .not('question', 'is', null)
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DesignOpportunityQuestion[];
}

/* ---------------- Profile + portfolio ---------------- */

export type DesignerProfilePatch = {
  display_name?: string;
  city?: string;
  bio?: string | null;
  typical_turnaround_days?: number | null;
  rate_min?: number | null;
  rate_max?: number | null;
};

export async function updateMyDesignerProfile(designerId: string, patch: DesignerProfilePatch) {
  const { error } = await supabase.from('designer_profiles').update(patch).eq('id', designerId);
  if (error) throw error;
}

export async function getMySpecialties(designerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('designer_specialties')
    .select('specialty')
    .eq('designer_id', designerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.specialty);
}

export async function setMySpecialties(designerId: string, specialties: string[]) {
  const current = await getMySpecialties(designerId);
  const toAdd = specialties.filter((s) => !current.includes(s));
  const toRemove = current.filter((s) => !specialties.includes(s));

  if (toRemove.length) {
    const { error } = await supabase
      .from('designer_specialties')
      .delete()
      .eq('designer_id', designerId)
      .in('specialty', toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from('designer_specialties')
      .insert(toAdd.map((specialty) => ({ designer_id: designerId, specialty })));
    if (error) throw error;
  }
}

export async function getMyPortfolio(designerId: string): Promise<DesignerPortfolioItemRow[]> {
  const { data, error } = await supabase
    .from('designer_portfolio_items')
    .select('*')
    .eq('designer_id', designerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Public URL for a portfolio sample — the bucket is public, it is a shopfront. */
export function portfolioUrl(storagePath: string): string {
  return supabase.storage.from('designer-portfolio').getPublicUrl(storagePath).data.publicUrl;
}

export const MAX_PORTFOLIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_PORTFOLIO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Mirrors the bucket's own limits so the failure is explained before the upload. */
export function validatePortfolioFile(file: File): string | null {
  if (!ALLOWED_PORTFOLIO_TYPES.includes(file.type)) {
    return 'Upload a JPG, PNG, WebP, or PDF.';
  }
  if (file.size > MAX_PORTFOLIO_BYTES) {
    return 'That file is larger than 10MB.';
  }
  return null;
}

/**
 * Reads pixel dimensions in the browser before upload.
 *
 * Stored so the admin review queue can flag low-resolution samples. Deliberately
 * client-side and best-effort: there is no server-side image processing here,
 * and a PDF (or an image that fails to decode) simply stores nulls rather than
 * blocking the upload. The flag is a hint for a human, not a gate.
 */
function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export async function uploadPortfolioItem(designerId: string, file: File, caption?: string) {
  const problem = validatePortfolioFile(file);
  if (problem) throw new Error(problem);

  const size = await readImageSize(file);
  // Path's first segment is the designer id — the storage policy reads it to
  // decide who may write here.
  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const path = `${designerId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('designer-portfolio')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('designer_portfolio_items').insert({
    designer_id: designerId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    width_px: size?.width ?? null,
    height_px: size?.height ?? null,
    caption: caption?.trim() || null,
  });
  if (error) throw error;
}

export async function deletePortfolioItem(item: DesignerPortfolioItemRow) {
  const { error } = await supabase.from('designer_portfolio_items').delete().eq('id', item.id);
  if (error) throw error;
  // Best-effort: the row is the source of truth for the UI, and a leftover
  // object is harmless next to a row pointing at a file that is gone.
  await supabase.storage.from('designer-portfolio').remove([item.storage_path]);
}
