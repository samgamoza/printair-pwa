import { supabase } from './client';
import type { Database } from './database.types';

export type ReviewRow = Database['public']['Tables']['reviews']['Row'];

export async function createReview(input: {
  orderId: string;
  rating: number;
  comment?: string | null;
  wouldWorkAgain: boolean;
}): Promise<ReviewRow> {
  const { data, error } = await supabase
    .rpc('create_review', {
      p_order_id: input.orderId,
      p_rating: input.rating,
      p_comment: input.comment ?? undefined,
      p_would_work_again: input.wouldWorkAgain,
    })
    .single();
  if (error) throw error;
  return data as ReviewRow;
}

export async function getReviewByOrder(orderId: string): Promise<ReviewRow | null> {
  const { data, error } = await supabase.from('reviews').select('*').eq('order_id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProviderReviews(partnerId: string): Promise<ReviewRow[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
