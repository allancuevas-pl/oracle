import { expect, test, describe } from 'vitest';
import { suggestAdopted, effectiveRate } from './adopted';

/**
 * Will asked on 2026-09-02 to type an adopted rate on the Project Feasibility
 * tab. The tab has always had a column headed "Adopted" and it was never a
 * field — every row rendered the static string "$/m²" under that heading, so
 * there was nowhere for the number to go. It was logged as "needs
 * reproduction" and then dropped from the working list.
 */
describe('suggestAdopted', () => {
  test('offers the midpoint of the evidence range', () => {
    expect(suggestAdopted(150, 200)).toBe(175);
    expect(suggestAdopted(8000, 12000)).toBe(10000);
  });

  test('a single-point range is still a legitimate suggestion', () => {
    expect(suggestAdopted(150, 150)).toBe(150);
  });

  test('suggests nothing unless BOTH ends are present', () => {
    // Halving one end of a range and calling it a midpoint would put a made-up
    // number in front of an analyst with the same confidence as a real one.
    expect(suggestAdopted(150, undefined)).toBeNull();
    expect(suggestAdopted(undefined, 200)).toBeNull();
    expect(suggestAdopted(null, null)).toBeNull();
  });

  test('tolerates a range entered backwards', () => {
    expect(suggestAdopted(200, 150)).toBe(175);
  });

  test('rounds to cents rather than emitting a long float', () => {
    expect(suggestAdopted(150, 175)).toBe(162.5);
    expect(suggestAdopted(100, 101)).toBe(100.5);
  });

  test('refuses nonsense instead of propagating NaN', () => {
    expect(suggestAdopted(NaN, 200)).toBeNull();
    expect(suggestAdopted(Infinity, 200)).toBeNull();
    expect(suggestAdopted('150', 200)).toBeNull();
    expect(suggestAdopted(-150, 200)).toBeNull();
  });

  test('a range from 0 is real', () => {
    expect(suggestAdopted(0, 200)).toBe(100);
    expect(suggestAdopted(0, 0)).toBe(0);
  });
});

describe('effectiveRate — what the model actually runs on', () => {
  test('the adopted rate wins once someone commits one', () => {
    expect(effectiveRate(175, 150)).toBe(175);
  });

  test('falls back to the LOW end, not the midpoint', () => {
    // The valuation stays deliberately conservative until a human adopts a
    // number on purpose. Quietly defaulting to the midpoint would inflate
    // every feaso in the system without anyone choosing it.
    expect(effectiveRate(undefined, 150)).toBe(150);
    expect(effectiveRate(null, 150)).toBe(150);
  });

  test('an adopted 0 is honoured, not treated as unset', () => {
    // The falsy-zero family once more: `adopted || low` would silently swap a
    // deliberate 0 for the range's low end.
    expect(effectiveRate(0, 150)).toBe(0);
  });

  test('null when there is nothing to run on', () => {
    expect(effectiveRate(undefined, undefined)).toBeNull();
    expect(effectiveRate(NaN, NaN)).toBeNull();
  });

  test('no existing feaso changes, because none has an adopted rate', () => {
    // The safety property of this change: with adopted unset the model uses
    // exactly what it used before, so no number on any live deal moves.
    for (const low of [0, 120, 150, 999.5]) {
      expect(effectiveRate(undefined, low)).toBe(low);
    }
  });
});
