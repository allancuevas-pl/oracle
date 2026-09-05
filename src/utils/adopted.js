/**
 * The adopted rate on a feasibility — the single number the analyst commits to,
 * as opposed to the min/max range the evidence supports.
 *
 * The Project Feasibility tab has always shown an "Adopted" column. It was
 * never a field: every row rendered the static string "$/m²" under that
 * heading. Will asked to type a rate there on 2026-09-02.
 *
 * Nothing here auto-applies. That mirrors the decision already made for the
 * adopted cap rate — "cap rate would be added manually by the team in most
 * cases; Oracle could suggest one" — so the midpoint is offered as a
 * suggestion and the analyst accepts it or types their own.
 */

/**
 * Midpoint of an evidence range, or null when it can't be suggested.
 *
 * Returns a number only when BOTH ends are present: suggesting a "midpoint"
 * from one end of a range is just repeating that end back with false
 * authority. A single-point range (low === high) is a legitimate suggestion.
 */
export function suggestAdopted(low, high) {
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!ok(low) || !ok(high)) return null;
  if (low < 0 || high < 0) return null;
  const [lo, hi] = low <= high ? [low, high] : [high, low];
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

/**
 * What the model should actually use: the adopted rate when one is set, else
 * the low end of the range.
 *
 * Low, not the midpoint — the valuation stays deliberately conservative until
 * somebody adopts a number on purpose. A 0 is honoured; it is a real adopted
 * rate, not a missing one.
 */
export function effectiveRate(adopted, low) {
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  if (ok(adopted)) return adopted;
  return ok(low) ? low : null;
}
