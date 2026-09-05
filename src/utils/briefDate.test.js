import { expect, test, describe } from 'vitest';
import { toDateInput, fromDateInput, daysOpen } from './briefDate';

/**
 * `startDate` was written once at creation and never again — no form field,
 * and updateBrief did not accept it. A brief is routinely entered into Oracle
 * weeks after the client actually engaged, and this value drives the "Opened N
 * days ago" headline, so a wrong one could not be corrected.
 */
describe('the date round trip', () => {
  test('a stored timestamp survives going to the input and back', () => {
    // The property that matters: opening a brief and saving it unchanged must
    // not move its open date. Same class as the numeric-zero round trip.
    const stored = Date.parse('2026-06-15T00:00:00Z');
    expect(fromDateInput(toDateInput(stored))).toBe(stored);
  });

  test('the calendar day does not drift', () => {
    // Both directions are UTC on purpose. Going through local time shifts the
    // day by one either side of midnight for anyone east of UTC — which is
    // everyone using this.
    expect(toDateInput(Date.parse('2026-06-15T00:00:00Z'))).toBe('2026-06-15');
    expect(toDateInput(Date.parse('2026-06-15T23:59:59Z'))).toBe('2026-06-15');
    expect(fromDateInput('2026-06-15')).toBe(Date.parse('2026-06-15T00:00:00Z'));
  });

  test('an unset date is blank, and blank stays unset', () => {
    expect(toDateInput(null)).toBe('');
    expect(toDateInput(undefined)).toBe('');
    expect(fromDateInput('')).toBeUndefined();
    expect(fromDateInput(undefined)).toBeUndefined();
  });

  test('garbage becomes undefined rather than NaN', () => {
    // NaN would fail Convex's v.number() validator at the boundary.
    expect(fromDateInput('not-a-date')).toBeUndefined();
    expect(toDateInput(NaN)).toBe('');
  });
});

describe('daysOpen', () => {
  const NOW = Date.parse('2026-09-05T00:00:00Z');

  test('counts whole days since the brief opened', () => {
    expect(daysOpen(Date.parse('2026-08-05T00:00:00Z'), NOW)).toBe(31);
    expect(daysOpen(NOW, NOW)).toBe(0);
  });

  test('a future open date reads as 0, never negative', () => {
    // "Opened -3 days ago" is the kind of thing that ends up in front of a
    // client. A typo in the new date field makes this reachable.
    expect(daysOpen(NOW + 3 * 86_400_000, NOW)).toBe(0);
  });

  test('a missing date is 0 rather than an exception', () => {
    // 4 of the 9 live briefs predate the field; the callers fall back to
    // _creationTime, but this must not throw if both are absent.
    expect(daysOpen(undefined, NOW)).toBe(0);
    expect(daysOpen(null, NOW)).toBe(0);
  });
});
