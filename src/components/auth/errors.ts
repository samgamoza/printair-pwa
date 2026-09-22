/**
 * How a failed signup is explained to the person.
 *
 * Kept out of steps.tsx so that file exports only components — react-refresh
 * warns otherwise, and the rule is worth keeping: a fast-refresh edit to a form
 * should not reload the whole module graph.
 */

/**
 * True when the backend refused because the address already has an account.
 *
 * Worth singling out: it is the one signup failure with an obvious next step,
 * so the caller can offer a way through to signing in rather than leaving the
 * person to work out that they already registered months ago.
 */
export function isDuplicateEmailError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : '';
  return /already registered|already exists|duplicate|user already/i.test(msg);
}

export function describeSignupError(e: unknown): string {
  if (isDuplicateEmailError(e)) {
    return 'An account with that email already exists. Sign in instead, or use a different address.';
  }
  const msg = e instanceof Error ? e.message : '';
  if (msg) return msg;
  return 'Something went wrong creating your account. Please try again.';
}
