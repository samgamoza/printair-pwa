import { supabase } from './client';
import type { Database } from './database.types';

export type DesignDeliverableRow = Database['public']['Tables']['design_deliverables']['Row'];

export const DESIGN_DELIVERABLE_BUCKET = 'design-deliverables';
export const MAX_DELIVERABLE_BYTES = 50 * 1024 * 1024; // matches the bucket's 50MB file_size_limit
const ALLOWED_DELIVERABLE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.ai', '.eps', '.zip'];

export function validateDeliverableFile(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_DELIVERABLE_TYPES.includes(ext)) {
    return `That file type isn't supported. Use one of: ${ALLOWED_DELIVERABLE_TYPES.join(', ')}.`;
  }
  if (file.size > MAX_DELIVERABLE_BYTES) {
    return 'That file is larger than 50MB.';
  }
  return null;
}

/**
 * Uploads the file, then calls submit_design_deliverable() to record the
 * revision row — the RPC computes revision_number server-side (max existing +
 * 1) so two concurrent uploads can never collide, and moves a CONFIRMED order
 * to IN_PROGRESS on the first one. If the RPC call fails after a successful
 * upload, the orphaned storage object is harmless (no row points at it) and
 * is left for a future cleanup pass rather than compounding the error here.
 */
export async function uploadDesignDeliverable(orderId: string, file: File): Promise<DesignDeliverableRow> {
  const invalid = validateDeliverableFile(file);
  if (invalid) throw new Error(invalid);

  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const path = `${orderId}/${Date.now()}-${safeName}`;
  const { error: uploadErr } = await supabase.storage.from(DESIGN_DELIVERABLE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadErr) throw uploadErr;

  const { data, error } = await supabase
    .rpc('submit_design_deliverable', {
      p_order_id: orderId,
      p_storage_path: path,
      p_file_name: file.name,
      p_mime_type: file.type || undefined,
      p_size_bytes: file.size,
    })
    .single();
  if (error) throw error;
  return data as DesignDeliverableRow;
}

export async function getDeliverables(orderId: string): Promise<DesignDeliverableRow[]> {
  const { data, error } = await supabase
    .from('design_deliverables')
    .select('*')
    .eq('order_id', orderId)
    .order('revision_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDeliverableDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DESIGN_DELIVERABLE_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

/** Customer approves a revision (closes the order) or sends it back with feedback. */
export async function reviewDeliverable(deliverableId: string, approved: boolean, feedback?: string): Promise<DesignDeliverableRow> {
  const { data, error } = await supabase
    .rpc('review_design_deliverable', { p_deliverable_id: deliverableId, p_approved: approved, p_feedback: feedback })
    .single();
  if (error) throw error;
  return data as DesignDeliverableRow;
}
