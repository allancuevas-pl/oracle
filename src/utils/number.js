/**
 * Converting numbers between a stored record and a text form field.
 *
 * Both directions have bitten us with the same bug: `value ? ... : ''` and
 * `value || undefined` treat a legitimate **0** as "not set". That is not
 * cosmetic here — a 0 loaded as blank and saved back deletes the field, and
 * Convex's `patch` removes any key set to `undefined`.
 *
 * Real cases in this data: a WALE of 0 (lease fully expired — 30A Carrington
 * Road is in exactly that state), a 0% yield on a vacant asset, 0 building
 * area on bare land. Use these helpers instead of truthiness on any numeric
 * field that a user can edit.
 */

/**
 * Stored number → form field string. Preserves 0; null/undefined become ''.
 *   0    -> "0"      (NOT "")
 *   5.5  -> "5.5"
 *   null -> ""
 */
export function toFormString(value) {
  return value == null ? '' : String(value);
}

/**
 * Form field string → stored number. Preserves 0; blank/garbage become
 * undefined so the caller can omit the key rather than write a bad value.
 *   "0"   -> 0        (NOT undefined)
 *   "5.5" -> 5.5
 *   ""    -> undefined
 *   "abc" -> undefined
 */
export function toNumberOrUndefined(value) {
  if (value == null) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const trimmed = String(value).trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}
