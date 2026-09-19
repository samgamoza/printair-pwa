import { describe, it, expect } from 'vitest';
import {
  axesFor,
  columnFromInches,
  columnToInches,
  composeDimensions,
  describeInUnit,
  parseDimensions,
  sanitizeDimensionInput,
} from './dimensions';
import { dimensionShapeFor } from '@/data/catalog';
import { UNSURE } from '@/lib/api/projects';

const BOX = axesFor('box');   // Length, Width, Height
const BAG = axesFor('bag');   // Width, Height, Gusset
const FLAT = axesFor('flat'); // Width, Height

describe('axis order is fixed', () => {
  it('uses the folding-carton standard for boxes', () =>
    expect(BOX).toEqual(['Length', 'Width', 'Height']));
  it('gives bags a gusset instead of a length', () =>
    expect(BAG).toEqual(['Width', 'Height', 'Gusset']));
  it('gives flat work two axes', () => expect(FLAT).toEqual(['Width', 'Height']));
});

describe('composeDimensions', () => {
  it('writes a box spec a partner can read', () =>
    expect(composeDimensions(['8', '8', '5'], BOX)).toBe('8 × 8 × 5 in (L×W×H)'));

  it('labels a bag with its gusset', () =>
    expect(composeDimensions(['10', '14', '4'], BAG)).toBe('10 × 14 × 4 in (W×H×G)'));

  it('writes two axes for flat work', () =>
    expect(composeDimensions(['3', '2'], FLAT)).toBe('3 × 2 in (W×H)'));

  it('always stores inches, whatever was typed', () =>
    expect(composeDimensions(columnToInches(['20', '20', '13'], 'cm'), BOX)).toBe(
      '7.874 × 7.874 × 5.118 in (L×W×H)',
    ));

  it('returns empty when nothing was entered, so the column stays null', () =>
    expect(composeDimensions(['', '', ''], BOX)).toBe(''));

  it('marks a partial spec so the gap is visible rather than silently dropped', () =>
    expect(composeDimensions(['8', '', '5'], BOX)).toBe('8 × ? × 5 in (L×W×H)'));

  it('ignores values beyond the axis count', () =>
    expect(composeDimensions(['3', '2', '9'], FLAT)).toBe('3 × 2 in (W×H)'));
});

describe('parseDimensions', () => {
  it('round-trips a box spec', () => {
    const stored = composeDimensions(['8', '8', '5'], BOX);
    expect(parseDimensions(stored, 3)).toEqual({ inches: ['8', '8', '5'] });
  });

  it('round-trips decimals', () => {
    const stored = composeDimensions(['8.5', '2', '1.25'], BOX);
    expect(parseDimensions(stored, 3)).toEqual({ inches: ['8.5', '2', '1.25'] });
  });

  it('round-trips a partial spec back to blanks', () => {
    const stored = composeDimensions(['8', '', '5'], BOX);
    expect(parseDimensions(stored, 3)).toEqual({ inches: ['8', '', '5'] });
  });

  it('normalises a legacy centimetre spec to inches', () =>
    expect(parseDimensions('20.32 × 20.32 × 12.7 cm (L×W×H)', 3)).toEqual({
      inches: ['8', '8', '5'],
    }));

  it('normalises a legacy millimetre spec to inches', () =>
    expect(parseDimensions('254 × 254 mm (W×H)', 2)).toEqual({ inches: ['10', '10'] }));

  it('accepts a plain lowercase x, which customers type more often than ×', () =>
    expect(parseDimensions('8 x 8 x 5 in', 3)).toEqual({ inches: ['8', '8', '5'] }));

  // Everything below returns null so the caller falls back to free text rather
  // than destroying what the customer actually typed.
  it('rejects free text', () => expect(parseDimensions('about the size of a shoebox', 3)).toBeNull());
  it('rejects the half-typed value that prompted this field', () =>
    expect(parseDimensions('5x', 3)).toBeNull());
  it('rejects a spec with no unit', () => expect(parseDimensions('8 × 8 × 5', 3)).toBeNull());
  it('rejects an unknown unit', () => expect(parseDimensions('8 × 8 × 5 ft (L×W×H)', 3)).toBeNull());
  it('rejects a mismatched axis count', () =>
    expect(parseDimensions('8 × 8 × 5 in (L×W×H)', 2)).toBeNull());
  it('treats "not sure" as absent', () => expect(parseDimensions(UNSURE, 3)).toBeNull());
  it('treats empty as absent', () => expect(parseDimensions('', 3)).toBeNull());
});

describe('unit conversion at the door', () => {
  it('converts centimetres in', () =>
    expect(columnToInches(['20.32', '12.7'], 'cm')).toEqual(['8', '5']));
  it('converts millimetres in', () =>
    expect(columnToInches(['254', '127'], 'mm')).toEqual(['10', '5']));
  it('leaves inches alone', () => expect(columnToInches(['8', '5'], 'in')).toEqual(['8', '5']));
  it('keeps blanks blank rather than turning them into zero', () =>
    expect(columnToInches(['8', '', '5'], 'in')).toEqual(['8', '', '5']));

  it('converts back out for display', () =>
    expect(columnFromInches(['8', '5'], 'cm')).toEqual(['20.32', '12.7']));

  it('survives a cm -> in -> cm round trip', () =>
    expect(columnFromInches(columnToInches(['20.32', '12.7'], 'cm'), 'cm')).toEqual([
      '20.32',
      '12.7',
    ]));

  it('builds the on-screen echo', () =>
    expect(describeInUnit(['8', '8', '5'], 'cm')).toBe('20.32 × 20.32 × 12.7 cm'));
  it('shows the gap in a partial echo', () =>
    expect(describeInUnit(['8', '', '5'], 'cm')).toBe('20.32 × ? × 12.7 cm'));
  it('has nothing to echo when empty', () => expect(describeInUnit(['', ''], 'cm')).toBe(''));
});

describe('sanitizeDimensionInput', () => {
  it('strips letters', () => expect(sanitizeDimensionInput('5x')).toBe('5'));
  it('allows one decimal point', () => expect(sanitizeDimensionInput('8.5')).toBe('8.5'));
  it('drops a second decimal point, which would not round-trip', () =>
    expect(sanitizeDimensionInput('5.5.5')).toBe('5.55'));
  it('collapses a run of points', () => expect(sanitizeDimensionInput('..')).toBe('.'));
  it('keeps a leading point, which Number() accepts', () =>
    expect(sanitizeDimensionInput('.5')).toBe('.5'));
  it('caps absurd length', () => expect(sanitizeDimensionInput('123456789012').length).toBe(8));
  it('drops a minus rather than silently flipping the sign later', () =>
    expect(sanitizeDimensionInput('-3')).toBe('3'));
  it('does not turn 1e5 into 15 by keeping the digits either side of the e', () =>
    expect(sanitizeDimensionInput('1e5')).toBe('15'));
});

describe('dimensionShapeFor', () => {
  it('gives boxes three axes', () => expect(dimensionShapeFor('product-box')).toBe('box'));
  it('treats food trays as three-dimensional', () => expect(dimensionShapeFor('food-tray')).toBe('box'));
  it('gives bags a gusset', () => expect(dimensionShapeFor('retail-bag')).toBe('bag'));
  it('keeps stickers flat', () => expect(dimensionShapeFor('labels-diecut')).toBe('flat'));
  it('keeps flyers flat', () => expect(dimensionShapeFor('marketing-flyer')).toBe('flat'));
  it('keeps posters and tarpaulin-style work flat', () =>
    expect(dimensionShapeFor('marketing-poster')).toBe('flat'));

  it('leaves genuinely bespoke items as free text', () =>
    expect(dimensionShapeFor('corporate-kit')).toBeNull());
  it('returns null for an unknown id', () => expect(dimensionShapeFor('nope')).toBeNull());
  it('returns null when no item was chosen', () => expect(dimensionShapeFor(null)).toBeNull());
});
