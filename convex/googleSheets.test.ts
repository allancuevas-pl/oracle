import { expect, test, describe } from "vitest";
import { isRetryableGoogleError } from "./googleSheets";

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
