import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/catalog';
import { readBudget, stripBudget, withBudget } from './budget';
import { SEASON_KITS, activeKits } from './seasons';
import { sukiFor } from './suki';
import { isPreviewable, isTrackable } from './checks';
import { ago, describe as say, usable, type ActivityEvent } from './activity';

describe('budget line in notes', () => {
  it('adds a labelled line and reads it back', () => {
    const notes = withBudget('Timeline preference: 2–3 weeks.', '5000');
    expect(notes).toContain('Timeline preference: 2–3 weeks.\nTarget budget: ₱5,000.');
    expect(readBudget(notes)).toBe('5000');
    expect(stripBudget(notes)).toBe('Timeline preference: 2–3 weeks.');
  });
  it('replaces rather than stacks', () => {
    const twice = withBudget(withBudget('Hello', '5000'), '7500');
    expect(twice.match(/Target budget/g)).toHaveLength(1);
    expect(readBudget(twice)).toBe('7500');
  });
  it('leaves notes alone for an empty, zero or non-numeric budget', () => {
    for (const bad of ['', '  ', '0', '-5', 'abc']) expect(withBudget('Hello', bad)).toBe('Hello');
    expect(withBudget(withBudget('Hello', '5000'), '')).toBe('Hello');
    expect(withBudget('', '5000')).toMatch(/^Target budget: ₱5,000\./);
  });
});

describe('season kits', () => {
  it('every kit points at a real category', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const kit of SEASON_KITS) expect(ids.has(kit.categoryId), kit.id).toBe(true);
  });
  it('shows a kit only while there is still time to order', () => {
    const sept = activeKits(new Date(2026, 8, 20)).map((k) => k.id);
    expect(sept).toEqual(['1111', 'christmas']);
    expect(activeKits(new Date(2026, 8, 20))[0].daysLeft).toBe(30);
    expect(activeKits(new Date(2026, 10, 16)).map((k) => k.id)).not.toContain('christmas');
    expect(activeKits(new Date(2026, 6, 1))).toEqual([]);
  });
  it('rolls over the year end', () => {
    expect(activeKits(new Date(2026, 11, 28)).map((k) => k.id)).toContain('valentines');
  });
});

describe('suki status', () => {
  it('is earned by delivered orders', () => {
    expect(sukiFor(0).tier.key).toBe('new');
    expect(sukiFor(2).toGo).toBe(1);
    expect(sukiFor(3).tier.key).toBe('suki');
    expect(sukiFor(10).tier.key).toBe('super');
    expect(sukiFor(25).next).toBeNull();
    expect(sukiFor(25).progress).toBe(1);
  });
});

describe('checks', () => {
  it('tracks only real production statuses', () => {
    expect(isTrackable('IN_PRODUCTION')).toBe(true);
    expect(isTrackable('AWAITING_PAYMENT')).toBe(false);
  });
  it('previews images, never PDFs', () => {
    expect(isPreviewable({ type: 'image/png' } as File)).toBe(true);
    expect(isPreviewable({ type: 'application/pdf' } as File)).toBe(false);
    expect(isPreviewable(null)).toBe(false);
  });
});

describe('marketplace activity', () => {
  const now = new Date(2026, 8, 20, 12).getTime();
  const at = (mins: number) => new Date(now - mins * 60_000).toISOString();
  it('describes a business type and a city, never a person', () => {
    expect(say({ id: '1', kind: 'project_posted', category: 'coffee', city: 'Pasig City', at: at(1) })).toBe('A coffee shop in Pasig City just posted a print project');
    expect(say({ id: '2', kind: 'quotes_received', category: 'bakery', city: null, quotes: 3, at: at(1) })).toBe('A bakery just received 3 quotes');
    expect(say({ id: '3', kind: 'quotes_received', category: 'unknown', city: 'Cebu City', quotes: 1, at: at(1) })).toBe('A business in Cebu City just received a quote');
    expect(say({ id: '4', kind: 'order_delivered', category: null, city: null, partner: 'Manila Offset Press', at: at(1) })).toBe('Manila Offset Press just delivered an order');
  });
  it('drops anything stale, from the future or malformed', () => {
    const events = [
      { id: 'old', kind: 'project_posted', category: 'coffee', city: 'X', at: at(60 * 49) },
      { id: 'ok', kind: 'project_posted', category: 'coffee', city: 'X', at: at(30) },
      { id: 'newer', kind: 'order_delivered', category: null, city: null, at: at(5) },
      { id: 'future', kind: 'project_posted', category: null, city: null, at: at(-600) },
      { id: 'odd', kind: 'mary_ordered_5000_boxes', at: at(1) },
      null,
    ] as unknown as ActivityEvent[];
    expect(usable(events, now).map((e) => e.id)).toEqual(['newer', 'ok']);
    expect(usable('nope', now)).toEqual([]);
  });
  it('says how long ago in plain words', () => {
    expect(ago(at(0), now)).toBe('just now');
    expect(ago(at(18), now)).toBe('18 min ago');
    expect(ago(at(180), now)).toBe('3 hr ago');
    expect(ago(at(60 * 30), now)).toBe('yesterday');
  });
});
