/**
 * Display-only mirror of booking_fee_pct() in
 * supabase/migrations/20260807000100_booking_payments.sql. The database is
 * the sole source of truth for the actual charged amount (computed and
 * stored on booking_payments.amount inside select_quote()) — this constant
 * only lets the UI show an estimate before that row exists.
 */
export const BOOKING_FEE_PCT = 5;

export function estimateBookingFee(quotePrice: number): number {
  return Math.round(quotePrice * (BOOKING_FEE_PCT / 100) * 100) / 100;
}

export function formatPHP(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
