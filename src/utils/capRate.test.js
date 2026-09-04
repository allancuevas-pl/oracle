import { expect, test, describe } from 'vitest';
import { suggestCapRate } from './capRate';

describe('suggestCapRate', () => {
  const at = (...rates) => rates.map((capRate, i) => ({ _id: `c${i}`, capRate }));

  test('returns null when no comp carries a cap rate', () => {
    // The live case today: 34 of 39 sale comps have a price but no income,
    // so nothing should be suggested rather than a number with no basis.
    expect(suggestCapRate([])).toBeNull();
    expect(suggestCapRate([{ salePrice: 1_000_000 }, { salePrice: 2_000_000 }])).toBeNull();
  });

  test('uses the median, so one outlier cannot drag it', () => {
    // A distressed sale at 2% alongside four normal ones.
    const s = suggestCapRate(at(2, 5.2, 5.4, 5.6, 5.8));
    expect(s.median).toBe(5.4);
    expect(s.count).toBe(5);
  });

  test('averages the middle pair for an even sample', () => {
    expect(suggestCapRate(at(5, 6)).median).toBe(5.5);
  });

  test('reports the sample size and range so the analyst can judge it', () => {
    const s = suggestCapRate(at(6.03, 3.7, 5.29, 5.43));
    expect(s.count).toBe(4);
    expect(s.min).toBe(3.7);
    expect(s.max).toBe(6.03);
  });

  test('a single comp still suggests, but says it is a single comp', () => {
    const s = suggestCapRate(at(5.5));
    expect(s).toEqual({ median: 5.5, count: 1, min: 5.5, max: 5.5 });
  });

  test('ignores a decimal fraction typed into a percent field', () => {
    // 0.055 means 5.5%, not 0.055%. Counting it would halve the median.
    const s = suggestCapRate(at(0.055, 5.4, 5.6));
    expect(s.count).toBe(2);
    expect(s.median).toBe(5.5);
  });

  test('ignores impossible values and non-numbers', () => {
    expect(suggestCapRate(at(0, -4, 95, NaN, null, undefined, '5.5'))).toBeNull();
  });

  test('rounds to two decimals', () => {
    expect(suggestCapRate(at(5.333, 5.334)).median).toBe(5.33);
  });

  test('survives a malformed comp list', () => {
    expect(suggestCapRate(null)).toBeNull();
    expect(suggestCapRate(undefined)).toBeNull();
    expect(suggestCapRate([null, undefined, {}])).toBeNull();
  });
});
