/**
 * How long a deal has sat in its current stage, and whether that's a problem.
 *
 * `matches` carried no timestamp of any kind, so "this deal hasn't moved in a
 * month" was simply not answerable — the board showed where every deal was and
 * nothing about how long it had been there. A deal quietly parked in Under
 * Review for six weeks looked identical to one that moved this morning.
 *
 * The thresholds below are a DEFAULT, not a house rule from Property Lions.
 * They are deliberately per-stage, because the stages have genuinely different
 * clocks: a client sitting on a report for three weeks is a problem, whereas
 * Due Diligence running six weeks is just due diligence. Will should adjust
 * these once he's seen them against real deals.
 */

/** Days in a stage before a deal is flagged. Falls back to DEFAULT_STALE_DAYS. */
export const STALE_DAYS_BY_STAGE = {
  Shortlisted: 21,
  Prepping: 14,
  'Report Ready': 7,       // sitting on a finished report is pure delay
  'Under Review': 14,      // waiting on the client
  'Client Approved': 10,
  'Offer Submitted': 14,
  'Under Offer': 21,
  Negotiating: 21,
  'Offer Accepted': 14,
  'Contract Execution': 21,
  'Due Diligence': 45,     // a real DD period; not a warning sign on its own
  Unconditional: 30,
};

export const DEFAULT_STALE_DAYS = 21;

/** Whole days the deal has been in its current stage. */
export function daysInStage(statusChangedAt, now = Date.now()) {
  if (statusChangedAt == null || !Number.isFinite(statusChangedAt)) return null;
  return Math.max(0, Math.floor((now - statusChangedAt) / 86_400_000));
}

/**
 * Staleness for one deal.
 *
 * Returns `{ days, threshold, isStale }`, or null when it cannot be judged —
 * a terminal stage (Settlement, Client Rejected: those are finished, not
 * stalled) or a match with no timestamp yet. Null means "say nothing", which
 * is the right default for a flag that nags.
 */
export function stalenessOf(match, stage, now = Date.now()) {
  if (!match || stage?.terminal) return null;
  const days = daysInStage(match.statusChangedAt, now);
  if (days === null) return null;
  const threshold = STALE_DAYS_BY_STAGE[stage?.id] ?? DEFAULT_STALE_DAYS;
  return { days, threshold, isStale: days >= threshold };
}

/** "3d" / "12d" / "2mo" — compact enough for a board card. */
export function formatStageAge(days) {
  if (days == null) return '';
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
