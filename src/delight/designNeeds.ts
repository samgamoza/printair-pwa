/**
 * "I need a logo, labels and a box."
 *
 * A design request has one `specialty` column, and the backend fans a request
 * out to designers on that one value. But a customer's job is rarely one thing:
 * a new product wants a logo, its labels and its box together. So the form asks
 * for every need, and the full list travels the same way the budget does — as
 * one labelled line at the end of the notes, where designers already read —
 * while the specialty column gets the discipline that covers most of the list.
 *
 * Until the backend grows a many-to-many (docs/BACKEND-FOLLOWUPS.md §7), the
 * request reaches designers of that primary specialty only.
 */
import { DESIGN_NEEDS } from '@/data/catalog';

const LINE = /\n?Design needs: [^\n]*$/;

/** The needs named in a notes line, as catalog ids. Unknown names are dropped. */
export function readNeeds(notes: string | null | undefined): string[] {
  const m = (notes ?? '').match(/Design needs: ([^\n]*)/);
  if (!m) return [];
  const names = m[1].split(' · ').map((s) => s.replace(/\.$/, '').trim());
  return DESIGN_NEEDS.filter((n) => names.includes(n.name)).map((n) => n.id);
}

export function stripNeeds(notes: string | null | undefined): string {
  return (notes ?? '').replace(LINE, '').trimEnd();
}

/**
 * The chosen needs by name, with "Something else" replaced by what the
 * customer typed for it — that is the whole point of the free-text field.
 */
function namesFor(needIds: string[], other?: string, key: 'name' | 'short' = 'name'): string[] {
  const typed = other?.trim();
  return DESIGN_NEEDS.filter((n) => needIds.includes(n.id)).map((n) => (n.id === 'other' && typed ? typed : n[key]));
}

export function withNeeds(notes: string, needIds: string[], other?: string): string {
  const base = stripNeeds(notes);
  const names = namesFor(needIds, other);
  if (names.length === 0) return base;
  const line = `Design needs: ${names.join(' · ')}.`;
  return base ? `${base}\n${line}` : line;
}

/**
 * The one specialty to file the request under: whichever covers the most of
 * what was picked, first-picked breaking ties. A logo plus labels plus a box
 * files under packaging if "box" and "mockup" were both chosen, else under
 * whichever came first — the customer's own emphasis, absent a better signal.
 */
export function primarySpecialtyFor(needIds: string[]): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const id of needIds) {
    const need = DESIGN_NEEDS.find((n) => n.id === id);
    if (!need) continue;
    if (!counts.has(need.specialty)) order.push(need.specialty);
    counts.set(need.specialty, (counts.get(need.specialty) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const specialty of order) {
    const c = counts.get(specialty) ?? 0;
    if (c > bestCount) {
      best = specialty;
      bestCount = c;
    }
  }
  return best;
}

/**
 * A description made only of the needs, for when the customer wrote none.
 * "Requested: Logo & brand mark, Labels & stickers." — factual, nothing added.
 */
export function describeNeeds(needIds: string[], other?: string): string {
  const names = namesFor(needIds, other);
  return names.length ? `Requested: ${names.join(', ')}.` : '';
}

/**
 * The request's name, made from its needs: "Logo, Labels & Box". Customers
 * used to type a title, and the ask was one more thing between them and
 * posting; the needs already say what the job is. The date on the list tells
 * two "Logo & Labels" requests apart.
 */
export function titleForNeeds(needIds: string[], other?: string): string {
  // A typed "something else" names the request, cut short so the list stays tidy.
  const typed = other?.trim();
  const shorts = namesFor(needIds, typed && typed.length > 28 ? `${typed.slice(0, 27).trimEnd()}…` : typed, 'short');
  if (shorts.length === 0) return 'Design request';
  if (shorts.length === 1) return shorts[0] === 'Design' ? 'Design request' : shorts[0];
  return `${shorts.slice(0, -1).join(', ')} & ${shorts[shorts.length - 1]}`;
}

/**
 * The designer's side of the same vocabulary.
 *
 * A designer picks what they design from DESIGN_NEEDS (minus "something
 * else") and can add skills of their own. The four `specialties` the backend
 * matches on are derived from the picks; the full list, custom skills included,
 * becomes the profile bio customers read in the directory — so "Invitations,
 * Menus, Hand-lettering" is visible even though only "product-graphics" is
 * stored for matching.
 */
export function specialtiesForCapabilities(capabilityIds: string[]): string[] {
  const out: string[] = [];
  for (const id of capabilityIds) {
    const c = DESIGN_NEEDS.find((n) => n.id === id);
    if (c && c.id !== 'other' && !out.includes(c.specialty)) out.push(c.specialty);
  }
  return out;
}

export function bioForCapabilities(capabilityIds: string[], customSkills: string[]): string {
  const names = DESIGN_NEEDS.filter((n) => n.id !== 'other' && capabilityIds.includes(n.id)).map((n) => n.name);
  const all = [...names, ...customSkills.map((s) => s.trim()).filter(Boolean)];
  return all.length ? `Designs: ${all.join(', ')}.` : '';
}
