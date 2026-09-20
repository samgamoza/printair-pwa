/**
 * Is this person on a connection where every kilobyte counts?
 *
 * True when they have asked their browser to save data, or the browser itself rates the link as 2G.
 * Used to skip things that are nice but not needed: warming code in advance, decorative photos.
 * Where the browser doesn't say (Safari, Firefox) the answer is "no" and nothing changes.
 */
type NetworkInformation = { saveData?: boolean; effectiveType?: string };

export function isConstrained(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!c) return false;
  return c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

/** Run when the browser has nothing better to do, and never on a constrained connection. */
export function whenIdleAndUnconstrained(task: () => void, fallbackDelay = 2500) {
  if (isConstrained()) return;
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(task, { timeout: 6000 });
  else window.setTimeout(task, fallbackDelay);
}
