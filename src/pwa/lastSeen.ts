import { useSyncExternalStore } from 'react';

/**
 * "Last seen" — what the app shows when the connection is weak or gone.
 *
 * A native app opens onto what it showed you last time and then catches up. A web app normally
 * opens onto a spinner, and on a bad connection the spinner never ends. This closes that gap for
 * READING, and only reading:
 *
 *   - Every successful read from the database (GET/HEAD to Supabase's /rest/v1/) is saved on the
 *     device, per signed-in person.
 *   - The network is ALWAYS asked first. The saved copy is used only when the network fails, the
 *     server is unavailable, or the answer is taking too long (SLOW_AFTER_MS) — in which case the
 *     request keeps going in the background and the app offers to refresh when it lands.
 *   - Whenever a saved copy is on screen the app says so, with its time (see StaleStrip). Silent
 *     staleness is the thing to avoid: an old quote presented as current is worse than an error.
 *   - Writes (submitting, quoting, choosing, paying, uploading) are never saved, queued or replayed.
 *     They either reach the server now or fail with a plain message. Replaying a quote or a payment
 *     later, unseen, is not a risk worth taking.
 *   - Payment rows are never served from a saved copy at all: their whole point is to be current.
 *   - Signing out, or a different person signing in, wipes it. Copies older than MAX_AGE_MS are dropped.
 *
 * The service worker still never caches Supabase (vite.config.ts). This lives in the page instead
 * because only the page knows who is signed in, and only the page can tell the person what they
 * are looking at.
 *
 * It works by wrapping window.fetch before the Supabase client is created — the same seam demo mode
 * uses — so nothing in src/lib (the data layer shared with the website) changes.
 */

const SLOW_AFTER_MS = 4500;
/** Once the connection has shown itself to be bad, don't make every following request prove it again. */
const SLOW_AFTER_MS_WHEN_KNOWN_BAD = 700;
const KNOWN_BAD_FOR_MS = 30_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 250;
const CACHE_PREFIX = 'printair-last-seen-';
const KEY_ORIGIN = 'https://last-seen.printair.invalid';
const SAVED_AT = 'x-printair-saved-at';
/** Tables whose rows must be live or not shown at all. */
const NEVER_STALE = /\/rest\/v1\/(booking_payments|design_payments)\b/;

/* ---------- what is currently on screen from a saved copy ---------- */

type Snapshot = { oldest: number | null; fresher: boolean };
let stale = new Map<string, number>();
let fresher = false;
let snapshot: Snapshot = { oldest: null, fresher: false };
const listeners = new Set<() => void>();

function publish() {
  const times = [...stale.values()];
  snapshot = { oldest: times.length ? Math.min(...times) : null, fresher };
  listeners.forEach((l) => l());
}

/** Called on every route change, before the new page asks for anything. */
export function clearLastSeenNotice() {
  if (!stale.size && !fresher) return;
  stale = new Map();
  fresher = false;
  publish();
}

/** `oldest`: when the oldest saved copy now on screen was saved. `fresher`: the network has since answered. */
export function useLastSeen(): Snapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

/* ---------- helpers ---------- */

/** Who a request is made as: the `sub` of its bearer token, or "anon" for the public key. */
function personOf(headers: Headers): string {
  const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const payload = token?.split('.')[1];
  if (!payload) return 'anon';
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.sub === 'string' ? json.sub : 'anon';
  } catch {
    return 'anon';
  }
}

/** The same URL can answer differently depending on these (single row vs list, counts, paging). */
function keyFor(method: string, url: URL, headers: Headers): string {
  const vary = ['accept', 'prefer', 'range', 'accept-profile'].map((h) => headers.get(h) ?? '').join('|');
  return `${KEY_ORIGIN}/${method}${url.pathname}?q=${encodeURIComponent(url.search)}&v=${encodeURIComponent(vary)}`;
}

async function wipeExcept(keep: string | null) {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== keep).map((n) => caches.delete(n)));
}

async function save(cacheName: string, key: string, response: Response) {
  // HEAD answers (counts) have no body; everything that matters is in the headers.
  const body = response.status === 204 || response.status === 304 ? null : await response.blob();
  const headers = new Headers(response.headers);
  headers.set(SAVED_AT, String(Date.now()));
  const cache = await caches.open(cacheName);
  // The Cache API refuses partial (206) answers, which is what a paged list is. The data layer only
  // looks at `ok` and the content-range header, so it is stored as a plain 200.
  await cache.put(key, new Response(body, { status: response.status === 206 ? 200 : response.status, statusText: response.statusText, headers }));
}

async function load(cacheName: string, key: string): Promise<{ response: Response; savedAt: number } | null> {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key);
  if (!hit) return null;
  const savedAt = Number(hit.headers.get(SAVED_AT));
  if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
    void cache.delete(key);
    return null;
  }
  return { response: hit, savedAt };
}

async function prune(cacheName: string) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const dated = await Promise.all(keys.map(async (k) => ({ k, at: Number((await cache.match(k))?.headers.get(SAVED_AT)) || 0 })));
  dated.sort((a, b) => a.at - b.at);
  await Promise.all(dated.slice(0, keys.length - MAX_ENTRIES).map((d) => cache.delete(d.k)));
}

const plainFailure = () =>
  new TypeError(
    navigator.onLine
      ? "We couldn't reach PrintAir. Check your connection and try again."
      : "You're offline. Nothing was sent. Try again when you're connected.",
  );

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------- install ---------- */

export function installLastSeen(supabaseUrl: string) {
  if (typeof window === 'undefined' || !('caches' in window) || !supabaseUrl) return;
  let origin: string;
  try {
    origin = new URL(supabaseUrl).origin;
  } catch {
    return;
  }

  const network = window.fetch.bind(window);
  let currentPerson: string | null = null;
  let badUntil = 0;
  // Bumped on sign-out. An answer that was still on its way when the person signed out must not be
  // saved after the wipe.
  let epoch = 0;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Read what is needed without building a Request from `input`: doing that to a Request that has
    // a body would take the body away from the real call below.
    const isRequest = typeof Request !== 'undefined' && input instanceof Request;
    const url = new URL(isRequest ? input.url : String(input), window.location.href);
    if (url.origin !== origin) return network(input, init);

    const method = (init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    const requestHeaders = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));

    // Signing out: nothing of theirs stays on the device.
    if (url.pathname.startsWith('/auth/v1/logout')) {
      clearLastSeenNotice();
      epoch += 1;
      void wipeExcept(null);
      currentPerson = null;
    }

    const readable = (method === 'GET' || method === 'HEAD') && url.pathname.startsWith('/rest/v1/');
    if (!readable) {
      // Writes, sign-in, files, edge functions: straight through, with a message a person can act on.
      try {
        return await network(input, init);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw plainFailure();
      }
    }

    const person = personOf(requestHeaders);
    const cacheName = CACHE_PREFIX + person;
    if (person !== 'anon' && person !== currentPerson) {
      currentPerson = person;
      void wipeExcept(cacheName).then(() => prune(cacheName));
    }
    const key = keyFor(method, url, requestHeaders);
    const mayUseSaved = !NEVER_STALE.test(url.pathname);

    const attempt = async (): Promise<Response> => {
      try {
        return await network(input, init);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (!navigator.onLine) throw error;
        await wait(700); // one quiet retry: weak connections drop single requests all the time
        return network(input, init);
      }
    };

    const startedAt = Date.now();
    const startedIn = epoch;
    const live = attempt().then((response) => {
      if (Date.now() - startedAt < 1500) badUntil = 0; // answering briskly again
      if (response.ok) {
        if (startedIn === epoch) {
          void save(cacheName, key, response.clone())
            .then(() => (startedIn === epoch ? undefined : caches.delete(cacheName)))
            .catch(() => {});
        }
        if (stale.has(key)) {
          // A saved copy of this is on screen and the real answer has now arrived.
          fresher = true;
          publish();
        }
      }
      return response;
    });

    const fallBackToSaved = async (): Promise<Response | null> => {
      if (!mayUseSaved) return null;
      const saved = await load(cacheName, key).catch(() => null);
      if (!saved) return null;
      stale.set(key, saved.savedAt);
      publish();
      return saved.response;
    };

    const slow = wait(Date.now() < badUntil ? SLOW_AFTER_MS_WHEN_KNOWN_BAD : SLOW_AFTER_MS).then(() => 'slow' as const);
    let first: Response | 'slow';
    try {
      first = await Promise.race([live, slow]);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      badUntil = Date.now() + KNOWN_BAD_FOR_MS;
      const saved = await fallBackToSaved();
      if (saved) return saved;
      throw plainFailure();
    }

    if (first === 'slow') {
      badUntil = Date.now() + KNOWN_BAD_FOR_MS;
      const saved = await fallBackToSaved();
      if (saved) {
        live.catch(() => {}); // still running; its result refreshes the saved copy
        return saved;
      }
      try {
        first = await live; // nothing saved: there is no better option than waiting
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw plainFailure();
      }
    }

    if (first.status >= 502 && first.status <= 504) {
      const saved = await fallBackToSaved();
      if (saved) return saved;
    }
    return first;
  };
}

/** Ask the browser not to evict what the installed app has saved when the device runs low on space. */
export function keepStorage() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone && navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
}
