/**
 * Client-side mirrors of the rules enforced in the database (see
 * supabase/migrations/20260804000200_functions.sql and 000300_rls.sql).
 *
 * These exist purely for fast, friendly form feedback — every rule here is
 * re-checked by a database constraint or RPC, which is the real authority.
 * Never trust these on their own for anything security-relevant.
 */

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Philippine mobile numbers: 09XXXXXXXXX, +639XXXXXXXXX, or 639XXXXXXXXX,
// with optional spaces/dashes (e.g. "0917 123 4567"). This is a format check
// only — it does not confirm the number is reachable. Real deliverability
// (OTP/SMS) is a separate step once a local SMS provider is wired up.
const PH_MOBILE_RE = /^(?:\+63|63|0)9\d{9}$/;

export function isValidMobile(mobile: string): boolean {
  const normalized = mobile.trim().replace(/[\s-]/g, '');
  return PH_MOBILE_RE.test(normalized);
}

export function isSecurePassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export type ProjectDraftInput = {
  title: string;
  category: string;
  description: string;
  deliveryCity: string;
  quantity?: number | null;
};

/** Mirrors submit_project(): a draft may be sparse, but a submission must have the essentials. */
export function validateProjectForSubmit(project: ProjectDraftInput): string[] {
  const errors: string[] = [];
  if (!project.title.trim()) errors.push('Give your project a title.');
  if (!project.category.trim()) errors.push('Choose a print category.');
  if (!project.description.trim()) {
    errors.push('Add a short description of what you need printed.');
  }
  if (!project.deliveryCity.trim()) {
    errors.push('Add a delivery city.');
  }
  if (project.quantity != null && project.quantity <= 0) {
    errors.push('Quantity must be greater than zero.');
  }
  return errors;
}

export const PROJECT_STATUSES = [
  'DRAFT',
  'OPEN_FOR_QUOTES',
  'PROVIDER_SELECTED',
  'IN_PROGRESS',
  'READY',
  'DELIVERED',
  'CANCELLED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function projectIsEditable(status: ProjectStatus): boolean {
  return status === 'DRAFT' || status === 'OPEN_FOR_QUOTES';
}

export function projectIsCancellable(status: ProjectStatus): boolean {
  return status === 'DRAFT' || status === 'OPEN_FOR_QUOTES';
}

// ---------------------------------------------------------------------------
// Partner business profile — mirrors partner_profiles' CHECK constraints
// ---------------------------------------------------------------------------

export type BusinessProfileInput = {
  businessName: string;
  contactName: string;
  city: string;
  typicalTurnaroundDays?: number | null;
};

export function validateBusinessProfile(profile: BusinessProfileInput): string[] {
  const errors: string[] = [];
  if (!profile.businessName.trim()) errors.push('Enter your printing business name.');
  if (!profile.contactName.trim()) errors.push('Enter a contact person.');
  if (!profile.city.trim()) errors.push('Enter your city.');
  if (profile.typicalTurnaroundDays != null) {
    if (!Number.isInteger(profile.typicalTurnaroundDays) || profile.typicalTurnaroundDays <= 0) {
      errors.push('Typical turnaround must be a whole number of days greater than zero.');
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Opportunity matching — mirrors distribute_opportunities()
// ---------------------------------------------------------------------------

/** A partner matches a project when the project's category is one of their capabilities. */
export function partnerMatchesCategory(partnerCategories: string[], projectCategory: string): boolean {
  return partnerCategories.includes(projectCategory);
}

// ---------------------------------------------------------------------------
// Quotations — mirrors quotes_submitted_is_complete and submit_quote()
// ---------------------------------------------------------------------------

export type QuoteDraftInput = {
  totalPrice: number | null;
  downPaymentPct: number | null;
  turnaroundDays: number | null;
  validUntil?: string | null; // ISO date
};

export function validateQuoteForSubmit(quote: QuoteDraftInput, today: Date = new Date()): string[] {
  const errors: string[] = [];
  if (quote.totalPrice == null || quote.totalPrice <= 0) {
    errors.push('Enter a total price greater than zero.');
  }
  if (quote.turnaroundDays == null || quote.turnaroundDays <= 0) {
    errors.push('Enter a turnaround of at least one day.');
  }
  if (quote.downPaymentPct == null || quote.downPaymentPct < 0 || quote.downPaymentPct > 100) {
    errors.push('Enter a down payment between 0 and 100%.');
  }
  if (quote.validUntil) {
    const validUntil = new Date(quote.validUntil + 'T00:00:00');
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (validUntil < todayMidnight) {
      errors.push('The validity date has already passed.');
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Orders — mirrors order_stage_rank() / update_order_status()
// ---------------------------------------------------------------------------

export const ORDER_STAGES = ['AWAITING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'] as const;
export type OrderStatus = (typeof ORDER_STAGES)[number];

export function orderStageRank(status: OrderStatus): number {
  return ORDER_STAGES.indexOf(status) + 1;
}

/** Orders move forward only — never sideways to the same stage, never backwards. */
export function canAdvanceOrder(current: OrderStatus, next: OrderStatus): boolean {
  return orderStageRank(next) > orderStageRank(current);
}

export function nextOrderStatus(current: OrderStatus): OrderStatus | null {
  const idx = ORDER_STAGES.indexOf(current);
  return idx >= 0 && idx < ORDER_STAGES.length - 1 ? ORDER_STAGES[idx + 1] : null;
}

// ---------------------------------------------------------------------------
// Reviews — mirrors create_review()
// ---------------------------------------------------------------------------

export function canReview(orderStatus: OrderStatus, alreadyReviewed: boolean): boolean {
  return orderStatus === 'DELIVERED' && !alreadyReviewed;
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

// ---------------------------------------------------------------------------
// Design requests — mirrors submit_design_request()
// ---------------------------------------------------------------------------

export type DesignRequestDraftInput = {
  title: string;
  specialty: string;
  description: string;
};

/** Mirrors submit_design_request(): a draft may be sparse, but a submission needs the essentials. */
export function validateDesignRequestForSubmit(request: DesignRequestDraftInput): string[] {
  const errors: string[] = [];
  if (!request.title.trim()) errors.push('Give your request a title.');
  if (!request.specialty.trim()) errors.push('Choose a design specialty.');
  if (!request.description.trim()) {
    errors.push('Add a short description of what you need designed.');
  }
  return errors;
}

export const DESIGN_REQUEST_STATUSES = [
  'DRAFT',
  'OPEN_FOR_PROPOSALS',
  'DESIGNER_SELECTED',
  'IN_PROGRESS',
  'DELIVERED',
  'CANCELLED',
] as const;
export type DesignRequestStatus = (typeof DESIGN_REQUEST_STATUSES)[number];

export function designRequestIsEditable(status: DesignRequestStatus): boolean {
  return status === 'DRAFT' || status === 'OPEN_FOR_PROPOSALS';
}

// ---------------------------------------------------------------------------
// Proposals — mirrors design_proposals_submitted_is_complete and submit_design_proposal()
// ---------------------------------------------------------------------------

export type ProposalDraftInput = {
  price: number | null;
  downPaymentPct: number | null;
  turnaroundDays: number | null;
  validUntil?: string | null; // ISO date
};

export function validateProposalForSubmit(proposal: ProposalDraftInput, today: Date = new Date()): string[] {
  const errors: string[] = [];
  if (proposal.price == null || proposal.price <= 0) {
    errors.push('Enter a price greater than zero.');
  }
  if (proposal.turnaroundDays == null || proposal.turnaroundDays <= 0) {
    errors.push('Enter a turnaround of at least one day.');
  }
  if (proposal.downPaymentPct == null || proposal.downPaymentPct < 0 || proposal.downPaymentPct > 100) {
    errors.push('Enter a down payment between 0 and 100%.');
  }
  if (proposal.validUntil) {
    const validUntil = new Date(proposal.validUntil + 'T00:00:00');
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (validUntil < todayMidnight) {
      errors.push('The validity date has already passed.');
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Design orders — mirrors design_order_stage_rank() / update_design_order_status()
// No READY stage: a design deliverable has no physical pickup step.
// ---------------------------------------------------------------------------

export const DESIGN_ORDER_STAGES = ['AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED'] as const;
export type DesignOrderStageStatus = (typeof DESIGN_ORDER_STAGES)[number];
