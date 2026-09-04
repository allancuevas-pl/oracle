import { expect, test, describe } from 'vitest';
import { formatCurrency, formatDate, formatFileSize } from './format';

/**
 * Five components had each forked their own copy of this function to get two
 * decimals, so the same sale rendered as $3.75M on the Feaso tab and $3.8M
 * wherever the shared helper was used. In a valuation tool that is a
 * credibility bug, not a cosmetic one. The precise form won; these tests pin
 * it so the forks can't creep back.
 */
describe('formatCurrency', () => {
  test('keeps two decimals in millions — the divergence that caused the forks', () => {
    expect(formatCurrency(3_750_000)).toBe('$3.75M');
    expect(formatCurrency(1_250_000)).toBe('$1.25M');
  });

  test('trims trailing zeros rather than padding', () => {
    expect(formatCurrency(15_000_000)).toBe('$15M');
    expect(formatCurrency(2_500_000)).toBe('$2.5M');
  });

  test('0 is a real value, not a missing one', () => {
    // The old guard was `if (!val) return fallback`, which rendered a real
    // zero as an em dash. Same class as the numeric-form bug in number.js.
    expect(formatCurrency(0)).toBe('$0');
  });

  test('only a genuinely absent value gets the fallback', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
    expect(formatCurrency(null, 'Not specified')).toBe('Not specified');
  });

  test('puts the sign before the dollar', () => {
    // Net profit goes negative and is read at a glance; $-3.75M misreads.
    expect(formatCurrency(-3_750_000)).toBe('-$3.75M');
    expect(formatCurrency(-450)).toBe('-$450');
  });

  test('rounds to whole thousands below a million', () => {
    expect(formatCurrency(719_000)).toBe('$719K');
    expect(formatCurrency(718_980)).toBe('$719K');
  });

  test('shows exact dollars below a thousand', () => {
    expect(formatCurrency(450)).toBe('$450');
  });
});

describe('formatDate', () => {
  test('formats as "D Mon YY"', () => {
    expect(formatDate(new Date('2026-09-04T02:00:00Z').getTime())).toMatch(/Sep 26$/);
  });

  test('an absent timestamp is an em dash', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatFileSize', () => {
  test('scales bytes to KB and MB', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(1_048_576)).toBe('1 MB');
  });

  test('an absent size renders as empty, not "0 B"', () => {
    expect(formatFileSize(null)).toBe('');
    expect(formatFileSize(0)).toBe('');
  });
});
