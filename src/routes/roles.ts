import type { Role } from '@/lib/api/auth';

/**
 * Where each role belongs when they land somewhere that is not theirs.
 *
 * A lookup rather than a ternary chain: adding the designer role meant a third
 * branch, and the chain had already been duplicated in the account menu — one
 * of them would have been missed.
 */
export const ROLE_HOME: Record<Role, string> = {
  customer: '/dashboard',
  partner: '/partner',
  designer: '/designer',
  admin: '/admin',
};

/** What the account menu calls each role's home. */
export const ROLE_DASHBOARD_LABEL: Record<Role, string> = {
  customer: 'My projects',
  partner: 'Partner dashboard',
  designer: 'Designer workspace',
  admin: 'Admin',
};
