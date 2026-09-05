import { expect, test, describe } from 'vitest';
import {
  daysInStage, stalenessOf, formatStageAge,
  STALE_DAYS_BY_STAGE, DEFAULT_STALE_DAYS,
} from './dealAge';

const NOW = Date.parse('2026-09-05T00:00:00Z');
const daysAgo = (d) => NOW - d * 86_400_000;

describe('daysInStage', () => {
  test('counts whole days since the last stage change', () => {
    expect(daysInStage(daysAgo(12), NOW)).toBe(12);
    expect(daysInStage(daysAgo(0), NOW)).toBe(0);
  });

  test('a deal moved today is 0 days, not "unknown"', () => {
    // 0 is a real answer here. Returning null would hide a fresh deal's age.
    expect(daysInStage(NOW, NOW)).toBe(0);
    expect(daysInStage(NOW, NOW)).not.toBeNull();
  });

  test('null when there is no timestamp at all', () => {
    // Every match predates this field until the backfill runs.
    expect(daysInStage(undefined, NOW)).toBeNull();
    expect(daysInStage(null, NOW)).toBeNull();
    expect(daysInStage(NaN, NOW)).toBeNull();
  });

  test('a future timestamp floors at 0 rather than going negative', () => {
    expect(daysInStage(NOW + 5 * 86_400_000, NOW)).toBe(0);
  });
});

describe('stalenessOf', () => {
  const stage = (id, terminal = false) => ({ id, label: id, terminal });

  test('flags a deal past its stage threshold', () => {
    // Report Ready is the tightest: a finished report nobody has sent is
    // pure delay, so 7 days.
    const r = stalenessOf({ statusChangedAt: daysAgo(9) }, stage('Report Ready'), NOW);
    expect(r).toEqual({ days: 9, threshold: 7, isStale: true });
  });

  test('does not flag the same age in a stage that legitimately runs long', () => {
    // 9 days into Due Diligence is just due diligence.
    const r = stalenessOf({ statusChangedAt: daysAgo(9) }, stage('Due Diligence'), NOW);
    expect(r.isStale).toBe(false);
    expect(r.threshold).toBe(45);
  });

  test('the threshold is inclusive — exactly at the mark counts', () => {
    expect(stalenessOf({ statusChangedAt: daysAgo(7) }, stage('Report Ready'), NOW).isStale).toBe(true);
    expect(stalenessOf({ statusChangedAt: daysAgo(6) }, stage('Report Ready'), NOW).isStale).toBe(false);
  });

  test('a finished deal is never stale', () => {
    // Settlement and Client Rejected are done, not stalled. Nagging about a
    // settled deal would train people to ignore the flag.
    for (const id of ['Settlement', 'Client Rejected']) {
      expect(stalenessOf({ statusChangedAt: daysAgo(400) }, stage(id, true), NOW)).toBeNull();
    }
  });

  test('says nothing when the deal has no timestamp', () => {
    expect(stalenessOf({}, stage('Prepping'), NOW)).toBeNull();
  });

  test('an unknown stage falls back to the default threshold', () => {
    // Legacy status names resolve through LEGACY_MAP, but a stage the map
    // misses must not crash or silently never flag.
    const r = stalenessOf({ statusChangedAt: daysAgo(25) }, stage('Something New'), NOW);
    expect(r.threshold).toBe(DEFAULT_STALE_DAYS);
    expect(r.isStale).toBe(true);
  });

  test('handles a missing match or stage without throwing', () => {
    expect(stalenessOf(null, stage('Prepping'), NOW)).toBeNull();
    expect(stalenessOf({ statusChangedAt: daysAgo(1) }, undefined, NOW))
      .toEqual({ days: 1, threshold: DEFAULT_STALE_DAYS, isStale: false });
  });

  test('every configured stage has a positive threshold', () => {
    for (const [id, days] of Object.entries(STALE_DAYS_BY_STAGE)) {
      expect(days, id).toBeGreaterThan(0);
    }
  });
});

describe('formatStageAge', () => {
  test('days below a month, months above', () => {
    expect(formatStageAge(0)).toBe('0d');
    expect(formatStageAge(29)).toBe('29d');
    expect(formatStageAge(30)).toBe('1mo');
    expect(formatStageAge(75)).toBe('2mo');
  });

  test('renders nothing when there is no age', () => {
    expect(formatStageAge(null)).toBe('');
  });
});
