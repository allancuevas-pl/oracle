import { expect, test, describe } from 'vitest';
import { toFormString, toNumberOrUndefined } from './number';

/**
 * The whole point of these helpers is that 0 survives. Every other assertion
 * here is secondary.
 */
describe('toFormString — stored number into a form field', () => {
  test('0 becomes "0", not blank', () => {
    // The bug: `wales ? String(wales) : ''` showed a fully-expired WALE as an
    // empty field, and saving that blank deleted the value.
    expect(toFormString(0)).toBe('0');
  });

  test('null and undefined become blank', () => {
    expect(toFormString(null)).toBe('');
    expect(toFormString(undefined)).toBe('');
  });

  test('ordinary numbers round-trip', () => {
    expect(toFormString(5.5)).toBe('5.5');
    expect(toFormString(15000000)).toBe('15000000');
  });
});

describe('toNumberOrUndefined — form field back into a stored number', () => {
  test('"0" becomes 0, not undefined', () => {
    // The bug: `parseFloat(x) || undefined` turned a typed 0 into undefined,
    // and Convex's patch removes any key set to undefined.
    expect(toNumberOrUndefined('0')).toBe(0);
  });

  test('blank and whitespace become undefined', () => {
    expect(toNumberOrUndefined('')).toBeUndefined();
    expect(toNumberOrUndefined('   ')).toBeUndefined();
    expect(toNumberOrUndefined(null)).toBeUndefined();
    expect(toNumberOrUndefined(undefined)).toBeUndefined();
  });

  test('non-numeric input becomes undefined rather than NaN', () => {
    // NaN would fail Convex's v.number() validator at the boundary.
    expect(toNumberOrUndefined('abc')).toBeUndefined();
    expect(toNumberOrUndefined('12abc')).toBeUndefined();
    expect(toNumberOrUndefined(NaN)).toBeUndefined();
    expect(toNumberOrUndefined(Infinity)).toBeUndefined();
  });

  test('parses decimals and negatives', () => {
    expect(toNumberOrUndefined('5.5')).toBe(5.5);
    expect(toNumberOrUndefined('-3')).toBe(-3);
    expect(toNumberOrUndefined(' 42 ')).toBe(42);
  });

  test('passes a real number straight through', () => {
    expect(toNumberOrUndefined(0)).toBe(0);
    expect(toNumberOrUndefined(7.25)).toBe(7.25);
  });
});

describe('the round trip that was losing data', () => {
  test('every value survives store -> form -> store unchanged', () => {
    // This is the property that matters: opening a record and saving it
    // without editing anything must not change it.
    for (const stored of [0, 0.5, 5.5, 100, 15000000, -2]) {
      expect(toNumberOrUndefined(toFormString(stored))).toBe(stored);
    }
    // And a genuinely unset field stays unset.
    expect(toNumberOrUndefined(toFormString(null))).toBeUndefined();
  });
});
