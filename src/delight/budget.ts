/**
 * "My budget is ₱5,000."
 *
 * Projects have no budget column, and this repo does not change the backend. So the figure travels
 * where printing partners already look: as one clearly labelled line at the end of the project's
 * notes. These helpers add, replace and read that line so the form can show it as its own field.
 */
const LINE = /\n?Target budget: ₱[\d,]+(?:\.\d+)?\.?[^\n]*$/;

export function readBudget(notes: string | null | undefined): string {
  const m = (notes ?? '').match(/Target budget: ₱([\d,]+(?:\.\d+)?)/);
  return m ? m[1].replace(/,/g, '') : '';
}

export function stripBudget(notes: string | null | undefined): string {
  return (notes ?? '').replace(LINE, '').trimEnd();
}

export function withBudget(notes: string, budget: string): string {
  const base = stripBudget(notes);
  const amount = Number(budget);
  if (!budget.trim() || !Number.isFinite(amount) || amount <= 0) return base;
  const line = `Target budget: ₱${amount.toLocaleString('en-PH')}. Please quote what fits, or suggest the closest option.`;
  return base ? `${base}\n${line}` : line;
}
