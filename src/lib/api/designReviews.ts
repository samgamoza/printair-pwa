import { supabase } from './client';
import type { Database } from './database.types';

export type DesignReviewRow = Database['public']['Tables']['design_reviews']['Row'];

export async function createDesignReview(input: {
  orderId: string;
  rating: number;
  comment?: string | null;
  wouldWorkAgain: boolean;
}): Promise<DesignReviewRow> {
  const { data, error } = await supabase
    .rpc('create_design_review', {
      p_order_id: input.orderId,
      p_rating: input.rating,
      p_comment: input.comment ?? undefined,
      p_would_work_again: input.wouldWorkAgain,
    })
    .single();
  if (error) throw error;
  return data as DesignReviewRow;
}

export async function getDesignReviewByOrder(orderId: string): Promise<DesignReviewRow | null> {
  const { data, error } = await supabase.from('design_reviews').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDesignerReviews(designerId: string): Promise<DesignReviewRow[]> {
  const { data, error } = await supabase
    .from('design_reviews')
    .select('*')
    .eq('designer_id', designerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
