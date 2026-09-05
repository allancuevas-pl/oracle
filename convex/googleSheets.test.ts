import { expect, test, describe } from "vitest";
import {
  isRetryableGoogleError,
  outgoingsRows,
  outgoingsOverflow,
  cashflowYears,
  vacancyByYear,
} from "./googleSheets";

/**
 * Google Drive returns 403 for two completely different things: "you are not
 * allowed to do this" and "you are going too fast". Only the `reason` in the
 * body separates them.
 *
 * This matters because regenerating a FEASO twice within a couple of minutes
 * is enough to trip the per-user limit — observed live on 2026-09-04, where it
 * surfaced as a hard failure with a raw Convex stack trace in the UI, and then
 * succeeded on a manual retry. Retrying a permissions 403 would instead hammer
 * Google with a request that can never succeed.
 */
describe("isRetryableGoogleError", () => {
  const rateLimit = JSON.stringify({
    error: {
      code: 403,
      message: "User rate limit exceeded.",
      errors: [{ message: "User rate limit exceeded.", domain: "usageLimits", reason: "userRateLimitExceeded" }],
    },
  });

  const permissionDenied = JSON.stringify({
    error: {
      code: 403,
      message: "The caller does not have permission",
      errors: [{ message: "The caller does not have permission", domain: "global", reason: "forbidden" }],
    },
  });

  test("retries the 403 we actually hit in production", () => {
    expect(isRetryableGoogleError(403, rateLimit)).toBe(true);
  });

  test("does NOT retry a permissions 403", () => {
    // Retrying this would never succeed — the service account has been removed
    // from the Shared Drive and a human needs to fix it.
    expect(isRetryableGoogleError(403, permissionDenied)).toBe(false);
  });

  test("retries 429 and server errors", () => {
    expect(isRetryableGoogleError(429, "")).toBe(true);
    expect(isRetryableGoogleError(500, "")).toBe(true);
    expect(isRetryableGoogleError(503, "")).toBe(true);
  });

  test("does not retry a missing template or a bad request", () => {
    expect(isRetryableGoogleError(404, "File not found")).toBe(false);
    expect(isRetryableGoogleError(400, "Invalid range")).toBe(false);
  });

  test("recognises the other transient reasons Google uses", () => {
    for (const reason of ["rateLimitExceeded", "backendError", "quotaExceeded"]) {
      expect(isRetryableGoogleError(403, `{"errors":[{"reason":"${reason}"}]}`)).toBe(true);
    }
  });
});

/**
 * Group D — the two FEASO tabs the generator never touched.
 *
 * Both inherited the master template verbatim, so every FEASO ever generated
 * shipped with whatever deal the master was last saved from. Same failure as
 * the "AH Beard" tenancy block Will caught on 2026-09-02, one tab over:
 * Outgoings carried $10k council rates / $5k water / $50k land tax / $5k
 * insurance, and Cashflow carried a 2025-2034 year row, a 50% year-one vacancy
 * and two 20% rent-growth spikes in years 4 and 8.
 */
describe("outgoingsRows", () => {
  test("writes the property's own outgoings", () => {
    const { rows } = outgoingsRows([
      { category: "Council Rates", amount: 12500, recoverable: true },
      { category: "Land Tax", amount: 31000, recoverable: false },
    ]);
    expect(rows![0]).toEqual(["Council Rates", 12500, "yes"]);
    expect(rows![1]).toEqual(["Land Tax", 31000, "no"]);
  });

  test("clears every unused row, so no stale line survives below the real ones", () => {
    // Two real items must not leave the master's Land Tax $50,000 sitting on
    // row 4 underneath them.
    const { rows } = outgoingsRows([
      { category: "Council Rates", amount: 12500, recoverable: true },
      { category: "Land Tax", amount: 31000, recoverable: false },
    ]);
    expect(rows).toHaveLength(7);
    for (const row of rows!.slice(2)) expect(row).toEqual(["", "", ""]);
  });

  test("with nothing recorded it clears the amounts but keeps the prompts", () => {
    // The item labels are the template's own checklist and are useful; the
    // dollar figures belong to another deal.
    const { rows, amountsOnly } = outgoingsRows([]);
    expect(rows).toBeNull();
    expect(amountsOnly).toEqual([[""], [""], [""], [""], [""], [""], [""]]);
    expect(outgoingsRows(undefined).amountsOnly).toHaveLength(7);
  });

  test("an amount of 0 is written, not treated as missing", () => {
    // The falsy-zero family: a recorded $0 land tax is a real answer.
    const { rows } = outgoingsRows([{ category: "Land Tax", amount: 0, recoverable: false }]);
    expect(rows![0]).toEqual(["Land Tax", 0, "no"]);
  });

  test("an unknown recoverable flag is left blank rather than guessed 'no'", () => {
    const { rows } = outgoingsRows([{ category: "Management", amount: 4000 }]);
    expect(rows![0]).toEqual(["Management", 4000, ""]);
  });

  test("reports anything that will not fit the template's seven rows", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ category: `Item ${i}`, amount: 100 }));
    expect(outgoingsOverflow(nine)).toBe(2);
    expect(outgoingsOverflow([{ category: "One", amount: 1 }])).toBe(0);
  });
});

describe("cashflowYears", () => {
  test("ten years starting from the year the sheet is generated", () => {
    // The master was frozen at 2025-2034, so a FEASO generated in 2027 still
    // said the model began in 2025.
    expect(cashflowYears(2026)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  });
});

describe("vacancyByYear", () => {
  test("year one comes from the feaso's vacancy allowance in months", () => {
    expect(vacancyByYear(6)[0]).toBe(0.5);
    expect(vacancyByYear(3)[0]).toBe(0.25);
  });

  test("the master's 50% was exactly six months of a previous deal", () => {
    // Which is why it looked plausible and survived unnoticed.
    expect(vacancyByYear(6)[0]).toBe(0.5);
    expect(vacancyByYear(0)[0]).toBe(0);
  });

  test("years two to ten are zero — an ongoing assumption is the analyst's call", () => {
    expect(vacancyByYear(6).slice(1)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("no allowance recorded leaves year one blank rather than assuming full occupancy", () => {
    expect(vacancyByYear(undefined)[0]).toBe("");
    expect(vacancyByYear(null)[0]).toBe("");
  });

  test("a nonsense allowance is clamped instead of producing a >100% vacancy", () => {
    expect(vacancyByYear(24)[0]).toBe(1);
    expect(vacancyByYear(-3)[0]).toBe(0);
  });
});
