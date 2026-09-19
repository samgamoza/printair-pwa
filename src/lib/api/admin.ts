import { supabase } from './client';
import type { Database } from './database.types';

export type AdminProfileRow = Database['public']['Tables']['profiles']['Row'];
export type AdminProjectRow = Database['public']['Tables']['projects']['Row'] & {
  customer: { full_name: string; email: string } | null;
};
export type AdminQuoteRow = Database['public']['Tables']['quotes']['Row'] & {
  project: { title: string } | null;
  partner: { business_name: string } | null;
};
export type AdminReviewRow = Database['public']['Tables']['reviews']['Row'];
export type AdminPartnerRow = Database['public']['Tables']['partner_profiles']['Row'];
export type AdminDesignReviewRow = Database['public']['Tables']['design_reviews']['Row'] & {
  designer: { display_name: string } | null;
  request: { title: string } | null;
};

/**
 * A pending designer application with the automated checks already evaluated.
 *
 * Comes from the designer_admin_review_queue view rather than designer_profiles
 * so the flags are computed in one place, in SQL, next to the data they
 * describe. The view is admin-gated internally (is_admin()), so a non-admin
 * calling this gets an empty list rather than an error.
 */
export type AdminDesignerApplicationRow =
  Database['public']['Views']['designer_admin_review_queue']['Row'];

/** A designer's portfolio samples, shown alongside their application. */
export type AdminPortfolioItemRow =
  Database['public']['Tables']['designer_portfolio_items']['Row'];

export const ADMIN_PAGE_SIZE = 25;

export type PagedResult<T> = { rows: T[]; count: number };

function pageRange(page: number, pageSize: number): [number, number] {
  const from = page * pageSize;
  return [from, from + pageSize - 1];
}

export async function listUsers(page = 0, pageSize = ADMIN_PAGE_SIZE): Promise<PagedResult<AdminProfileRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function listProviders(page = 0, pageSize = ADMIN_PAGE_SIZE): Promise<PagedResult<AdminPartnerRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('partner_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function listProjects(page = 0, pageSize = ADMIN_PAGE_SIZE): Promise<PagedResult<AdminProjectRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('projects')
    .select('*, customer:profiles(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AdminProjectRow[], count: count ?? 0 };
}

/** Joins project title and partner business name so an admin can identify a quote without a second lookup. */
export async function listQuotes(page = 0, pageSize = ADMIN_PAGE_SIZE): Promise<PagedResult<AdminQuoteRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('quotes')
    .select('*, project:projects(title), partner:partner_profiles(business_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AdminQuoteRow[], count: count ?? 0 };
}

export async function listReviews(page = 0, pageSize = ADMIN_PAGE_SIZE): Promise<PagedResult<AdminReviewRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('reviews')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

/**
 * Design reviews, with the designer named so an admin handling a complaint can
 * tell who it is about.
 *
 * admin_moderate_design_review() shipped with the designer schema but nothing
 * ever called it, so a review about a designer could not be hidden while one
 * about a printing partner could. Same moderation power on both halves.
 */
export async function listDesignReviews(page = 0, pageSize = ADMIN_PAGE_SIZE): Promise<PagedResult<AdminDesignReviewRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('design_reviews')
    .select('*, designer:designer_profiles(display_name), request:design_requests(title)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AdminDesignReviewRow[], count: count ?? 0 };
}

export async function moderateDesignReview(reviewId: string, hidden: boolean, reason: string) {
  const { error } = await supabase.rpc('admin_moderate_design_review', {
    p_review_id: reviewId,
    p_hidden: hidden,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function suspendAccount(userId: string, reason: string) {
  const { error } = await supabase.rpc('admin_set_account_status', {
    p_user_id: userId,
    p_status: 'suspended',
    p_reason: reason,
  });
  if (error) throw error;
}

export async function reinstateAccount(userId: string, reason: string) {
  const { error } = await supabase.rpc('admin_set_account_status', {
    p_user_id: userId,
    p_status: 'active',
    p_reason: reason,
  });
  if (error) throw error;
}

/**
 * Pending designer applications, oldest first.
 *
 * Deliberately oldest-first, unlike every other admin list here: this is a
 * work queue, not a browse view, and an applicant who has been waiting longest
 * should be dealt with first rather than buried under newer arrivals.
 */
export async function listDesignerApplications(
  page = 0,
  pageSize = ADMIN_PAGE_SIZE,
): Promise<PagedResult<AdminDesignerApplicationRow>> {
  const [from, to] = pageRange(page, pageSize);
  const { data, error, count } = await supabase
    .from('designer_admin_review_queue')
    .select('*', { count: 'exact' })
    .order('applied_at', { ascending: true })
    .range(from, to);
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

/** Portfolio samples for one applicant, so the reviewer can judge the work itself. */
export async function listDesignerPortfolio(designerId: string): Promise<AdminPortfolioItemRow[]> {
  const { data, error } = await supabase
    .from('designer_portfolio_items')
    .select('*')
    .eq('designer_id', designerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Approve, reject, or suspend a designer. The RPC requires a written reason and
 * writes an admin_audit_log entry, so every decision is attributable.
 */
export async function reviewDesigner(
  designerId: string,
  decision: 'active' | 'rejected' | 'suspended',
  reason: string,
) {
  const { error } = await supabase.rpc('admin_review_designer', {
    p_designer_id: designerId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) throw error;
}

/** Public URL for a portfolio sample. The bucket is public — it is a shopfront. */
export function portfolioImageUrl(storagePath: string): string {
  return supabase.storage.from('designer-portfolio').getPublicUrl(storagePath).data.publicUrl;
}

export async function moderateReview(reviewId: string, hidden: boolean, reason: string) {
  const { error } = await supabase.rpc('admin_moderate_review', {
    p_review_id: reviewId,
    p_hidden: hidden,
    p_reason: reason,
  });
  if (error) throw error;
}
