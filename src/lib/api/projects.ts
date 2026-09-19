import { supabase } from './client';
import type { Database } from './database.types';

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

/** Sentinel values technical fields use for "I'm not sure" / "Recommend for me". */
export const UNSURE = 'unsure';
export const RECOMMEND_FOR_ME = 'recommend';

export async function createProject(input: {
  customerId: string;
  title: string;
  category: string;
  description?: string | null;
  quantity?: number | null;
  quantityNote?: string | null;
  sizeSpec?: string | null;
  materialPref?: string | null;
  finishingPref?: string | null;
  targetDate?: string | null;
  deliveryCity?: string | null;
  notes?: string | null;
}): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      customer_id: input.customerId,
      title: input.title,
      category: input.category,
      description: input.description ?? null,
      quantity: input.quantity ?? null,
      quantity_note: input.quantityNote ?? null,
      size_spec: input.sizeSpec ?? null,
      material_pref: input.materialPref ?? null,
      finishing_pref: input.finishingPref ?? null,
      target_date: input.targetDate ?? null,
      delivery_city: input.deliveryCity ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, patch: Partial<ProjectUpdate>): Promise<ProjectRow> {
  const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function submitProject(id: string): Promise<ProjectRow> {
  const { data, error } = await supabase.rpc('submit_project', { p_project_id: id }).single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function cancelProject(id: string): Promise<ProjectRow> {
  const { data, error } = await supabase.rpc('cancel_project', { p_project_id: id }).single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function deleteDraftProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function getCustomerProjects(customerId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('customer_id', customerId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProjectDetails(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Artwork — one primary file per project, private bucket.
// ---------------------------------------------------------------------------

export const ARTWORK_BUCKET = 'artwork';
export const MAX_ARTWORK_BYTES = 25 * 1024 * 1024; // 25MB, under the 50MB project-wide storage cap
export const ALLOWED_ARTWORK_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.ai', '.zip'];

export function validateArtworkFile(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_ARTWORK_TYPES.includes(ext)) {
    return `That file type isn't supported. Use one of: ${ALLOWED_ARTWORK_TYPES.join(', ')}.`;
  }
  if (file.size > MAX_ARTWORK_BYTES) {
    return 'That file is larger than 25MB. Please compress it or share a link in your notes.';
  }
  return null;
}

export async function uploadProjectArtwork(projectId: string, userId: string, file: File) {
  const invalid = validateArtworkFile(file);
  if (invalid) throw new Error(invalid);

  const path = `${projectId}/${Date.now()}-${file.name}`;
  const { error: uploadErr } = await supabase.storage.from(ARTWORK_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
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

export async function getProjectFile(projectId: string) {
  const { data, error } = await supabase.from('project_files').select('*').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getArtworkDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(ARTWORK_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteProjectArtwork(projectId: string, storagePath: string) {
  const { error: rowErr } = await supabase.from('project_files').delete().eq('project_id', projectId);
  if (rowErr) throw rowErr;
  await supabase.storage.from(ARTWORK_BUCKET).remove([storagePath]);
}
