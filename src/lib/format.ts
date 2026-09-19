/** Small display helpers shared across screens. */

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A bare "2026-10-07" is parsed by JavaScript as midnight UTC, which west of Greenwich displays
 * as the day before. Date-only values are read as local dates instead.
 */
function parseDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

export function formatDate(value?: string | null, withYear = false): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Whole-peso display for list prices; `formatPHP` in pricing.ts keeps centavos for amounts being charged. */
export function peso(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `₱${Number(amount).toLocaleString('en-PH')}`;
}
