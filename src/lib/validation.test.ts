import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidMobile,
  isSecurePassword,
  validateProjectForSubmit,
  projectIsEditable,
  projectIsCancellable,
  partnerMatchesCategory,
  validateQuoteForSubmit,
  canAdvanceOrder,
  nextOrderStatus,
  canReview,
  isValidRating,
} from './validation';

describe('email + password', () => {
  it('accepts a normal email', () => expect(isValidEmail('liza@bakery.ph')).toBe(true));
  it('rejects a missing @', () => expect(isValidEmail('liza-bakery.ph')).toBe(false));
  it('rejects a missing domain', () => expect(isValidEmail('liza@')).toBe(false));
  it('requires at least 8 characters', () => {
    expect(isSecurePassword('short1')).toBe(false);
    expect(isSecurePassword('longenough1')).toBe(true);
  });
});

describe('isValidMobile', () => {
  it('accepts the common PH formats', () => {
    expect(isValidMobile('09171234567')).toBe(true);
    expect(isValidMobile('+639171234567')).toBe(true);
    expect(isValidMobile('639171234567')).toBe(true);
    expect(isValidMobile('0917 123 4567')).toBe(true);
    expect(isValidMobile('0917-123-4567')).toBe(true);
  });
  it('rejects landlines, short numbers, and non-PH numbers', () => {
    expect(isValidMobile('028123456')).toBe(false);
    expect(isValidMobile('0917123')).toBe(false);
    expect(isValidMobile('+14155552671')).toBe(false);
  });
  it('rejects empty input', () => expect(isValidMobile('')).toBe(false));
});

describe('validateProjectForSubmit', () => {
  const base = {
    title: 'Cake boxes',
    category: 'bakery',
    description: 'Windowed cake boxes, one colour logo.',
    deliveryCity: 'Pasig City',
  };

  it('passes a complete project', () => {
    expect(validateProjectForSubmit(base)).toEqual([]);
  });

  it('requires a description', () => {
    expect(validateProjectForSubmit({ ...base, description: '  ' })).toContain(
      'Add a short description of what you need printed.',
    );
  });

  it('requires a delivery city', () => {
    expect(validateProjectForSubmit({ ...base, deliveryCity: '' })).toContain('Add a delivery city.');
  });

  it('rejects a zero or negative quantity but allows it unset', () => {
    expect(validateProjectForSubmit({ ...base, quantity: 0 })).toContain('Quantity must be greater than zero.');
    expect(validateProjectForSubmit({ ...base, quantity: null })).toEqual([]);
  });
});

describe('project lifecycle flags', () => {
  it('is editable only in DRAFT or OPEN_FOR_QUOTES', () => {
    expect(projectIsEditable('DRAFT')).toBe(true);
    expect(projectIsEditable('OPEN_FOR_QUOTES')).toBe(true);
    expect(projectIsEditable('PROVIDER_SELECTED')).toBe(false);
    expect(projectIsEditable('DELIVERED')).toBe(false);
  });

  it('is cancellable only before a provider is selected', () => {
    expect(projectIsCancellable('OPEN_FOR_QUOTES')).toBe(true);
    expect(projectIsCancellable('IN_PROGRESS')).toBe(false);
  });
});

describe('partnerMatchesCategory', () => {
  it('matches when the category is a listed capability', () => {
    expect(partnerMatchesCategory(['bakery', 'food'], 'bakery')).toBe(true);
  });
  it('does not match an unrelated category', () => {
    expect(partnerMatchesCategory(['marketing'], 'bakery')).toBe(false);
  });
  it('does not match with no capabilities at all', () => {
    expect(partnerMatchesCategory([], 'bakery')).toBe(false);
  });
});

describe('validateQuoteForSubmit', () => {
  const base = { totalPrice: 18500, downPaymentPct: 50, turnaroundDays: 12, validUntil: null as string | null };

  it('passes a complete quote', () => {
    expect(validateQuoteForSubmit(base)).toEqual([]);
  });
  it('rejects zero or missing price', () => {
    expect(validateQuoteForSubmit({ ...base, totalPrice: 0 })).toContain('Enter a total price greater than zero.');
    expect(validateQuoteForSubmit({ ...base, totalPrice: null })).toContain('Enter a total price greater than zero.');
  });
  it('rejects zero turnaround', () => {
    expect(validateQuoteForSubmit({ ...base, turnaroundDays: 0 })).toContain(
      'Enter a turnaround of at least one day.',
    );
  });
  it('rejects an out-of-range down payment', () => {
    expect(validateQuoteForSubmit({ ...base, downPaymentPct: 150 })).toContain(
      'Enter a down payment between 0 and 100%.',
    );
    expect(validateQuoteForSubmit({ ...base, downPaymentPct: -5 })).toContain(
      'Enter a down payment between 0 and 100%.',
    );
  });
  it('rejects a validity date already in the past', () => {
    const today = new Date('2026-08-04T00:00:00');
    expect(validateQuoteForSubmit({ ...base, validUntil: '2026-08-01' }, today)).toContain(
      'The validity date has already passed.',
    );
    expect(validateQuoteForSubmit({ ...base, validUntil: '2026-08-04' }, today)).toEqual([]);
  });
});

describe('order stage progression', () => {
  it('allows moving forward one or more stages', () => {
    expect(canAdvanceOrder('CONFIRMED', 'IN_PRODUCTION')).toBe(true);
    expect(canAdvanceOrder('CONFIRMED', 'DELIVERED')).toBe(true);
  });
  it('rejects staying at the same stage', () => {
    expect(canAdvanceOrder('READY', 'READY')).toBe(false);
  });
  it('rejects moving backwards', () => {
    expect(canAdvanceOrder('READY', 'CONFIRMED')).toBe(false);
  });
  it('gives the next stage, or null after delivery', () => {
    expect(nextOrderStatus('CONFIRMED')).toBe('IN_PRODUCTION');
    expect(nextOrderStatus('DELIVERED')).toBeNull();
  });
});

describe('review eligibility', () => {
  it('allows a review only when delivered and not yet reviewed', () => {
    expect(canReview('DELIVERED', false)).toBe(true);
    expect(canReview('DELIVERED', true)).toBe(false);
    expect(canReview('READY', false)).toBe(false);
  });
  it('validates rating is an integer from 1 to 5', () => {
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
  });
});
