import { supabase } from './client';
import type { Database } from './database.types';

export type DesignRequestRow = Database['public']['Tables']['design_requests']['Row'];
export type DesignRequestUpdate = Database['public']['Tables']['design_requests']['Update'];
export type DesignRequestFileRow = Database['public']['Tables']['design_request_files']['Row'];

/**
 * Customer-side API for design_requests — mirrors lib/api/projects.ts exactly.
 *
 * Same discipline: create as a DRAFT row via a plain INSERT, then always move
 * to OPEN_FOR_PROPOSALS through submit_design_request(), never by setting
 * status directly. distribute_design_opportunities() only fires on
 * `AFTER UPDATE OF status` — an INSERT that set status straight to
 * OPEN_FOR_PROPOSALS would never fan out to any designer.
 */
export async function createDesignRequest(input: {
  customerId: string;
  title: string;
  specialty: string;
  description?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  targetDate?: string | null;
  notes?: string | null;
}): Promise<DesignRequestRow> {
  const { data, error } = await supabase
    .from('design_requests')
    .insert({
      customer_id: input.customerId,
      title: input.title,
      specialty: input.specialty,
      description: input.description ?? null,
      budget_min: input.budgetMin ?? null,
      budget_max: input.budgetMax ?? null,
      target_date: input.targetDate ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDesignRequest(id: string, patch: Partial<DesignRequestUpdate>): Promise<DesignRequestRow> {
  const { data, error } = await supabase.from('design_requests').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function submitDesignRequest(id: string): Promise<DesignRequestRow> {
  const { data, error } = await supabase.rpc('submit_design_request', { p_request_id: id }).single();
  if (error) throw error;
  return data as DesignRequestRow;
}

export async function cancelDesignRequest(id: string): Promise<DesignRequestRow> {
  const { data, error } = await supabase.rpc('cancel_design_request', { p_request_id: id }).single();
  if (error) throw error;
  return data as DesignRequestRow;
}

export async function deleteDraftDesignRequest(id: string): Promise<void> {
  const { error } = await supabase.from('design_requests').delete().eq('id', id);
  if (error) throw error;
}

export async function getCustomerDesignRequests(customerId: string): Promise<DesignRequestRow[]> {
  const { data, error } = await supabase
    .from('design_requests')
    .select('*')
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getDesignRequestDetails(id: string): Promise<DesignRequestRow | null> {
  const { data, error } = await supabase.from('design_requests').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Reference files — the design brief. Several per request (unlike project
// artwork, which is one file), private 'design-briefs' bucket.
// ---------------------------------------------------------------------------

export const DESIGN_BRIEF_BUCKET = 'design-briefs';
export const MAX_BRIEF_BYTES = 25 * 1024 * 1024; // matches the bucket's 25MB file_size_limit
const ALLOWED_BRIEF_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.zip'];

export function validateBriefFile(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_BRIEF_TYPES.includes(ext)) {
    return `That file type isn't supported. Use one of: ${ALLOWED_BRIEF_TYPES.join(', ')}.`;
  }
  if (file.size > MAX_BRIEF_BYTES) {
    return 'That file is larger than 25MB. Please compress it or share a link in your notes.';
  }
  return null;
}

export async function uploadDesignRequestFile(requestId: string, userId: string, file: File): Promise<DesignRequestFileRow> {
  const invalid = validateBriefFile(file);
  if (invalid) throw new Error(invalid);

  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const path = `${requestId}/${Date.now()}-${safeName}`;
  const { error: uploadErr } = await supabase.storage.from(DESIGN_BRIEF_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('design_request_files')
    .insert({
      request_id: requestId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDesignRequestFiles(requestId: string): Promise<DesignRequestFileRow[]> {
  const { data, error } = await supabase
    .from('design_request_files')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getBriefDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DESIGN_BRIEF_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDesignRequestFile(file: DesignRequestFileRow): Promise<void> {
  const { error } = await supabase.from('design_request_files').delete().eq('id', file.id);
  if (error) throw error;
  await supabase.storage.from(DESIGN_BRIEF_BUCKET).remove([file.storage_path]);
}
