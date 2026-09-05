/**
 * Comp date normalisation.
 *
 * `leaseDate` / `saleDate` / `leaseExpiry` are plain strings in the schema, and
 * nothing validated them. The comp scanner writes whatever the agent's table
 * said, so five live comps hold text where a date belongs: three "Upon
 * Completion", one "Q4 25", one "Q1 26".
 *
 * That is not cosmetic. The browse recency filter compares dates with a Convex
 * `gte` — a LEXICOGRAPHIC string comparison. "U" (85) and "Q" (81) both sort
 * above "2" (50), so every one of those comps passes *any* "since" filter and
 * presents as recent evidence, while a genuine 2019 comp is correctly excluded.
 * In a valuation tool the junk rows are the ones that survive the filter.
 *
 * The fix is at the write path: a date field holds an ISO date or nothing. Text
 * that isn't a date is handed back as `raw` so the caller can keep it in
 * `notes` rather than destroying it — "Upon Completion" is real information
 * about the lease, it just isn't a date.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const SLASHED = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const SLASHED_ISO = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
const MONTH_YEAR = /^([A-Za-z]{3,9})\.?\s+(\d{4})$/;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Rejects 2025-02-31 and friends — a regex match is not a real date. */
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export type NormalisedDate = {
  /** An ISO YYYY-MM-DD date, when the input was one. */
  date?: string;
  /** The original text, when it was not a date and must not be silently lost. */
  raw?: string;
};

/**
 * Parse whatever a scan or a form produced into an ISO date.
 *
 * Accepted: `YYYY-MM-DD`, `YYYY-MM` (→ first of month), `YYYY/M/D`,
 * `D/M/YYYY`, and `Mon YYYY` / `March 2025` (→ first of month).
 *
 * **`D/M/YYYY` is read day-first**, the Australian convention — every source
 * feeding this app is an Australian agent's table. `3/4/2025` is 3 April.
 *
 * Quarters ("Q4 25") are deliberately NOT parsed: calendar Q4 and Australian
 * financial-year Q4 are six months apart and the source rarely says which.
 * Guessing would put a wrong date in a valuation record, which is worse than
 * holding no date and keeping the text.
 */
export function normaliseCompDate(value?: string | null): NormalisedDate {
  if (value == null) return {};
  const v = String(value).trim();
  if (v === "") return {};

  let m: RegExpMatchArray | null;

  if ((m = v.match(ISO))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return isRealDate(y, mo, d) ? { date: iso(y, mo, d) } : { raw: v };
  }

  if ((m = v.match(ISO_MONTH))) {
    const [y, mo] = [+m[1], +m[2]];
    return isRealDate(y, mo, 1) ? { date: iso(y, mo, 1) } : { raw: v };
  }

  if ((m = v.match(SLASHED_ISO))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return isRealDate(y, mo, d) ? { date: iso(y, mo, d) } : { raw: v };
  }

  if ((m = v.match(SLASHED))) {
    const [d, mo, y] = [+m[1], +m[2], +m[3]];
    return isRealDate(y, mo, d) ? { date: iso(y, mo, d) } : { raw: v };
  }

  if ((m = v.match(MONTH_YEAR))) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return { date: iso(+m[2], mo, 1) };
    return { raw: v };
  }

  return { raw: v };
}

/** True when the stored value is a usable ISO date. */
export function isIsoDate(value?: string | null): boolean {
  return !!normaliseCompDate(value).date && ISO.test(String(value).trim());
}

/**
 * Fold non-date text back into a comp's notes so the information survives the
 * date field being cleared. Idempotent — re-running never stacks duplicates.
 */
export function noteForRawDate(
  notes: string | undefined,
  field: string,
  raw: string,
): string {
  const line = `${field} recorded as "${raw}"`;
  const existing = notes?.trim();
  if (existing?.includes(line)) return existing;
  return existing ? `${existing}\n${line}` : line;
}

/** The comp fields that must hold an ISO date or nothing. */
export const COMP_DATE_FIELDS = ["leaseDate", "saleDate", "leaseExpiry"] as const;

type CompDateFields = { leaseDate?: string; saleDate?: string; leaseExpiry?: string; notes?: string };

/**
 * Normalise every date field on a comp payload, moving unparseable text into
 * `notes`. Returns the fields to write — call it on create and on update so a
 * hand-typed value gets the same treatment as a scanned one.
 */
export function normaliseCompDateFields<T extends CompDateFields>(comp: T): T {
  const out: T = { ...comp };
  for (const field of COMP_DATE_FIELDS) {
    if (!(field in comp)) continue;
    const { date, raw } = normaliseCompDate(comp[field]);
    out[field] = date as T[typeof field];
    if (raw) out.notes = noteForRawDate(out.notes, field, raw) as T["notes"];
  }
  return out;
}
