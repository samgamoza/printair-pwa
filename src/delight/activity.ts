import { supabase } from '@/lib/api/client';

/**
 * "Happening on PrintAir": a quiet sign that the marketplace is alive.
 *
 * The rules that keep it worth having:
 *   - REAL events only. Nothing here is ever invented, padded or replayed. When nothing has
 *     happened lately, nothing is shown. (Demo mode has sample events; they never ship.)
 *   - No one is identifiable. The server sends a business TYPE and a CITY — never a customer's
 *     name, the project's title (free text; it may contain a brand name) or an exact quantity.
 *     Printing partners may be named: they are already public in the directory.
 *   - It is silent. Sounds are kept for things that happen to YOU (effects.ts).
 *
 * It needs one read-only backend function, `public_activity()`, that does the stripping on the
 * server so names never reach a browser (docs/BACKEND-FOLLOWUPS.md §6). Until that exists the feed
 * is off: set VITE_ACTIVITY_FEED=1 on the host once it does. With the switch off no request is made.
 */
export type ActivityKind = 'project_posted' | 'quotes_received' | 'order_delivered';

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  /** A catalog category id ("coffee", "bakery", …). Never the project's own title. */
  category: string | null;
  city: string | null;
  /** quotes_received only. */
  quotes?: number | null;
  /** order_delivered only: the printing partner's public business name. */
  partner?: string | null;
  at: string;
};

export type Activity = { events: ActivityEvent[]; deliveredTotal: number };

const ENABLED = import.meta.env.VITE_DEMO === '1' || import.meta.env.VITE_ACTIVITY_FEED === '1';
/** Older than this is history, not "happening". */
const FRESH_FOR_MS = 48 * 60 * 60 * 1000;
/** Below this the running total stays hidden: a small number says the opposite of what it is for. */
export const TOTAL_WORTH_SHOWING = 50;

const BUSINESS: Record<string, string> = {
  product: 'A product brand',
  food: 'A food business',
  coffee: 'A coffee shop',
  bakery: 'A bakery',
  beauty: 'A beauty brand',
  retail: 'A retail shop',
  corporate: 'A company',
};

export function describe(event: ActivityEvent): string {
  const who = (event.category && BUSINESS[event.category]) || 'A business';
  const where = event.city ? ` in ${event.city}` : '';
  switch (event.kind) {
    case 'project_posted':
      return `${who}${where} just posted a print project`;
    case 'quotes_received': {
      const n = Number(event.quotes) || 0;
      return n > 1 ? `${who}${where} just received ${n} quotes` : `${who}${where} just received a quote`;
    }
    case 'order_delivered':
      return event.partner ? `${event.partner} just delivered an order` : `An order${where} was just delivered`;
  }
}

export function ago(at: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(at).getTime()) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return 'yesterday';
}

/** Keeps only well-formed, recent events, newest first. Anything unexpected from the server is dropped, not shown. */
export function usable(events: unknown, now = Date.now()): ActivityEvent[] {
  if (!Array.isArray(events)) return [];
  const kinds: ActivityKind[] = ['project_posted', 'quotes_received', 'order_delivered'];
  return (events as ActivityEvent[])
    .filter((e) => e && typeof e.id === 'string' && kinds.includes(e.kind) && typeof e.at === 'string')
    .filter((e) => {
      const t = new Date(e.at).getTime();
      return Number.isFinite(t) && t <= now + 60_000 && now - t <= FRESH_FOR_MS;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);
}

let inFlight: Promise<Activity> | null = null;

/** One request per visit, shared by everything that shows activity. Never throws. */
export function getActivity(): Promise<Activity> {
  const none: Activity = { events: [], deliveredTotal: 0 };
  if (!ENABLED) return Promise.resolve(none);
  inFlight ??= (async () => {
    try {
      // Not in database.types.ts yet (src/lib is shared with the website and frozen), hence the cast.
      const rpc = supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>;
      const { data, error } = await rpc.call(supabase, 'public_activity');
      if (error || !data || typeof data !== 'object') return none;
      const body = data as { events?: unknown; delivered_total?: unknown };
      return { events: usable(body.events), deliveredTotal: Number(body.delivered_total) || 0 };
    } catch {
      return none;
    }
  })();
  return inFlight;
}
