/**
 * Weighted Average Lease Expiry.
 *
 * WALE was calculated once, at IM-scan time, and written to `properties.wales`
 * as a static number. The Tenancy Schedule tab — the screen where lease
 * expiries are actually edited — never recomputed it, so the headline figure
 * silently kept its scan-time value while the underlying leases changed.
 *
 * The calculation lives here so both callers share it: the scanner (which has
 * the AI's extraction shape) and `updatePropertyTenants` (which has the stored
 * tenant shape). Both map into `{ areaSqm, expiry }` first.
 *
 * `convex/` can be imported from `src/`, so the frontend uses this too.
 */

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

export type WaleEntry = {
  areaSqm?: number | null;
  /** "YYYY-MM-DD" */
  expiry?: string | null;
};

/**
 * Area-weighted years remaining: Σ(area × yearsLeft) / Σ(area).
 *
 * Returns null when nothing can be computed — no tenancies, or none carrying
 * both an area and an expiry. Null means "unknown" and callers must leave any
 * existing value alone rather than overwriting it with a wrong 0.
 *
 * An already-expired lease contributes 0 years but still contributes its area,
 * which is what drags a WALE down — that is the intended behaviour, and it is
 * why a WALE of exactly 0 is a real, meaningful value.
 */
export function calcWale(entries: WaleEntry[], now: number = Date.now()): number | null {
  let weightedSum = 0;
  let totalArea = 0;

  for (const e of entries ?? []) {
    const area = typeof e?.areaSqm === "number" && Number.isFinite(e.areaSqm) ? e.areaSqm : null;
    if (area === null || area <= 0 || !e?.expiry) continue;

    const expiryMs = Date.parse(e.expiry);
    if (Number.isNaN(expiryMs)) continue;

    const yearsLeft = Math.max(0, (expiryMs - now) / MS_PER_YEAR);
    weightedSum += area * yearsLeft;
    totalArea += area;
  }

  if (totalArea === 0) return null;
  return Math.round((weightedSum / totalArea) * 100) / 100;
}

/** Map the stored `properties.tenants` shape into the calculation's shape. */
export function waleFromTenants(
  tenants: Array<{ lettableArea?: number; leaseEnd?: string }> | undefined,
  now?: number,
): number | null {
  return calcWale(
    (tenants ?? []).map((t) => ({ areaSqm: t.lettableArea, expiry: t.leaseEnd })),
    now,
  );
}
