/**
 * The brief's "opened" date, moving between a stored ms timestamp and the
 * `yyyy-mm-dd` value an <input type="date"> wants.
 *
 * `startDate` was written once at creation and never again — no form field, and
 * `updateBrief` did not accept it. A brief is routinely entered into Oracle
 * weeks after the client actually engaged, and this value drives the "Opened N
 * days ago" headline on the brief and on the client's brief cards, so a wrong
 * one could not be corrected.
 *
 * Dates are handled in UTC on purpose: the stored value is a timestamp and the
 * input is a calendar day. Going through local time makes the day drift by one
 * either side of midnight for anyone east of UTC — which is everyone here.
 */

/** ms timestamp -> "yyyy-mm-dd" for a date input. '' when unset. */
export function toDateInput(ms) {
  if (ms == null || !Number.isFinite(ms)) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

/** "yyyy-mm-dd" -> ms timestamp at UTC midnight. undefined when blank/invalid. */
export function fromDateInput(value) {
  if (!value) return undefined;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Whole days between the open date and now, floored at 0.
 *
 * A future open date is a typo, not a negative age — "Opened -3 days ago" is
 * the kind of thing that ends up in front of a client.
 */
export function daysOpen(startMs, now = Date.now()) {
  if (startMs == null || !Number.isFinite(startMs)) return 0;
  return Math.max(0, Math.floor((now - startMs) / 86_400_000));
}
