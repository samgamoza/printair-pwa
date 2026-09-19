import { DIMENSION_AXES, type DimensionShape, type DimensionUnit } from '@/data/catalog';
import { UNSURE } from '@/lib/api/projects';

/**
 * Size specs are stored as a single human-readable string on `projects.size_spec`,
 * so nothing downstream — the partner brief, quotations, orders — needs a schema
 * change. These helpers are the only place that format is written or read, which
 * keeps the round-trip (compose -> save -> reload draft -> parse) honest.
 *
 * Two things are deliberately fixed rather than left to the customer:
 *
 *   Unit. Everything is stored in INCHES. The in-house quote model works in
 *   inches throughout (running sheet 21.5 x 15.5, large sheet 43 x 31, foil area
 *   in sq in), so storing anything else would mean converting somewhere in the
 *   pricing path — and every conversion is a chance to be wrong. Customers may
 *   still *enter* in cm or mm; that is converted at the door, never stored.
 *
 *   Axis order. Length x Width x Height, the standard for folding cartons and
 *   dielines. Deriving a flat blank for n-up (roughly 2(L+W) + glue flap across,
 *   H + tuck depth down) only works if which number is which is guaranteed.
 *
 * Canonical form: `8 × 8 × 5 in (L×W×H)`
 */

export const CANONICAL_UNIT: DimensionUnit = 'in';

const PER_INCH: Record<DimensionUnit, number> = { in: 1, cm: 2.54, mm: 25.4 };

/** Placeholder examples per shape, in axis order, in inches. */
export const DIMENSION_PLACEHOLDERS: Record<DimensionShape, string[]> = {
  box: ['8', '8', '5'],
  bag: ['10', '14', '4'],
  flat: ['3', '2'],
};

/** Trims float noise: 7.874015748 -> "7.874", 8.0 -> "8". */
export function tidyNumber(n: number, places = 3): string {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(places)));
}

export function toInches(value: number, from: DimensionUnit): number {
  return value / PER_INCH[from];
}

export function fromInches(value: number, to: DimensionUnit): number {
  return value * PER_INCH[to];
}

/** Converts a column of entered strings into canonical inches. Blanks stay blank. */
export function columnToInches(values: string[], from: DimensionUnit): string[] {
  return values.map((v) => {
    const t = v.trim();
    if (!t) return '';
    const n = Number(t);
    return Number.isFinite(n) ? tidyNumber(toInches(n, from)) : '';
  });
}

/** Converts canonical inches back out for display in the customer's entry unit. */
export function columnFromInches(values: string[], to: DimensionUnit): string[] {
  return values.map((v) => {
    const t = v.trim();
    if (!t) return '';
    const n = Number(t);
    return Number.isFinite(n) ? tidyNumber(fromInches(n, to), to === 'in' ? 3 : 2) : '';
  });
}

/**
 * Builds the stored string from values already in inches. Returns '' when
 * nothing was entered, so an untouched field stays null in the database rather
 * than saving `? × ? × ? in`. A partial spec keeps `?` for the blanks — a
 * partner reading "8 × ? × 5 in" can see exactly which number to ask for.
 */
export function composeDimensions(inchValues: string[], axes: string[]): string {
  const parts = inchValues.slice(0, axes.length);
  if (parts.every((v) => !v.trim())) return '';
  const nums = parts.map((v) => v.trim() || '?').join(' × ');
  return `${nums} ${CANONICAL_UNIT} (${axes.map((a) => a[0]).join('×')})`;
}

/**
 * Inverse of composeDimensions, always returning inches.
 *
 * Legacy specs written in cm or mm (before inches became canonical) are
 * converted rather than rejected, so old drafts open cleanly and normalise on
 * their next save.
 *
 * Returns null for anything this module could not have written — free text, or
 * an axis count that no longer matches the selected item (the customer went
 * back and swapped a box for a sticker). Callers treat null as "show it as free
 * text", so a customer's own words are never silently discarded.
 */
export function parseDimensions(value: string, axisCount: number): { inches: string[] } | null {
  if (!value || value === UNSURE) return null;
  const match = value.match(/^\s*([\d.?]+(?:\s*[×x]\s*[\d.?]+)*)\s*(in|cm|mm)\b/i);
  if (!match) return null;
  const parts = match[1].split(/[×x]/).map((p) => p.trim());
  if (parts.length !== axisCount) return null;
  if (parts.some((p) => p !== '?' && !/^\d*\.?\d+$/.test(p))) return null;
  const unit = match[2].toLowerCase() as DimensionUnit;
  return {
    inches: parts.map((p) => (p === '?' ? '' : tidyNumber(toInches(Number(p), unit)))),
  };
}

/** `8 × 8 × 5 in` -> `≈ 20.32 × 20.32 × 12.7 cm`, for the on-screen echo. */
export function describeInUnit(inchValues: string[], to: DimensionUnit): string {
  const shown = columnFromInches(inchValues, to);
  if (shown.every((v) => !v)) return '';
  return `${shown.map((v) => v || '?').join(' × ')} ${to}`;
}

/** Axis labels for a shape, e.g. ['Length', 'Width', 'Height']. */
export function axesFor(shape: DimensionShape): string[] {
  return DIMENSION_AXES[shape];
}

/**
 * Keystroke guard. Digits and at most one decimal point — nothing else can be
 * typed, so values that would fail to round-trip (`5.5.5`, `..`) never reach
 * the stored spec in the first place.
 */
export function sanitizeDimensionInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const first = cleaned.indexOf('.');
  if (first === -1) return cleaned.slice(0, 8);
  return (cleaned.slice(0, first + 1) + cleaned.slice(first + 1).replace(/\./g, '')).slice(0, 8);
}
