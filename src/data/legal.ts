/**
 * The facts the Privacy Policy and Terms pages need that only PrintAir's owner knows.
 *
 * BEFORE LAUNCH: fill every field, have the two pages read by someone qualified in Philippine
 * law (Data Privacy Act of 2012, Consumer Act, E-Commerce Act), then set `reviewed` to true.
 * While `reviewed` is false both pages carry a visible "Draft" notice, and `npm run build`
 * prints a reminder.
 *
 * The wording in src/pages/LegalPage.tsx describes what this app actually does with data
 * (checked against the code), but it is a starting draft, not legal advice.
 */
export const LEGAL = {
  reviewed: false,
  /** Registered business name, e.g. "PrintAir Inc." */
  operator: 'PrintAir',
  /** Registered business address. */
  address: '',
  /** Where privacy requests and questions go. */
  email: 'hello@printair.ph', // the address the website's footer already publishes — confirm it is the right one for privacy requests
  /** Shown as "Last updated". */
  updated: 'September 2026',
  /**
   * What happens to a platform fee when an order is cancelled. Nothing is written here on purpose:
   * it is a business decision. Until it is filled in, the Terms say refunds are handled on request.
   */
  refundPolicy: '',
};
