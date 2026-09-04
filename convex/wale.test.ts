import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { calcWale, waleFromTenants } from "./wale";

/**
 * WALE used to be computed once at IM-scan time and stored. Editing a lease
 * expiry on the Tenancy Schedule left the headline figure stale, with nothing
 * on screen saying so. These tests pin the calculation itself; the recompute
 * on save lives in updatePropertyTenants.
 */

// A fixed "now" so the expected years are exact rather than drifting daily.
const NOW = Date.parse("2026-01-01T00:00:00Z");
const inYears = (y: number) =>
  new Date(NOW + y * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe("calcWale", () => {
  test("weights by area, not by tenancy count", () => {
    // A big tenancy with a long lease should dominate a small short one.
    const wale = calcWale(
      [
        { areaSqm: 9000, expiry: inYears(5) },
        { areaSqm: 1000, expiry: inYears(1) },
      ],
      NOW,
    );
    // (9000*5 + 1000*1) / 10000 = 4.6
    expect(wale).toBeCloseTo(4.6, 1);
  });

  test("a single tenancy is just its own remaining term", () => {
    expect(calcWale([{ areaSqm: 500, expiry: inYears(3) }], NOW)).toBeCloseTo(3, 1);
  });

  test("an expired lease contributes 0 years but still counts its area", () => {
    // This is what drags a WALE down, and why a WALE of exactly 0 is real.
    const wale = calcWale(
      [
        { areaSqm: 1000, expiry: inYears(-2) },
        { areaSqm: 1000, expiry: inYears(4) },
      ],
      NOW,
    );
    expect(wale).toBeCloseTo(2, 1);
  });

  test("every lease expired gives exactly 0 — a real value, not 'unknown'", () => {
    const wale = calcWale([{ areaSqm: 800, expiry: inYears(-1) }], NOW);
    expect(wale).toBe(0);
  });

  test("returns null when nothing is computable", () => {
    // null means "leave the existing value alone" — it must never be
    // confused with a computed 0.
    expect(calcWale([], NOW)).toBeNull();
    expect(calcWale([{ areaSqm: 500 }], NOW)).toBeNull();
    expect(calcWale([{ expiry: inYears(3) }], NOW)).toBeNull();
    expect(calcWale([{ areaSqm: 0, expiry: inYears(3) }], NOW)).toBeNull();
  });

  test("skips unusable rows but still uses the good ones", () => {
    const wale = calcWale(
      [
        { areaSqm: 1000, expiry: inYears(4) },
        { areaSqm: null, expiry: inYears(1) },
        { areaSqm: 500, expiry: "not-a-date" },
      ],
      NOW,
    );
    expect(wale).toBeCloseTo(4, 1);
  });

  test("survives a malformed schedule", () => {
    expect(calcWale(undefined as never, NOW)).toBeNull();
    expect(calcWale([null as never, {} as never], NOW)).toBeNull();
  });
});

describe("waleFromTenants — the stored tenant shape", () => {
  test("maps lettableArea and leaseEnd", () => {
    const wale = waleFromTenants(
      [
        { lettableArea: 2000, leaseEnd: inYears(6) },
        { lettableArea: 2000, leaseEnd: inYears(2) },
      ],
      NOW,
    );
    expect(wale).toBeCloseTo(4, 1);
  });

  test("no tenancies means unknown, so the stored value is preserved", () => {
    expect(waleFromTenants([], NOW)).toBeNull();
    expect(waleFromTenants(undefined, NOW)).toBeNull();
  });
});

/**
 * The integration half: editing the tenancy schedule must move the stored
 * figure. The pure function above being right is necessary but not
 * sufficient — the bug was that nothing ever called it again.
 */
describe("updatePropertyTenants recomputes the stored WALE", () => {
  const modules = import.meta.glob("./**/*.*s");

  async function setup() {
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "staff_1", email: "staff@test.com", role: "staff",
    });
    const staff = t.withIdentity({ subject: "staff_1" });
    const propertyId = await t.run(async (ctx: any) =>
      ctx.db.insert("properties", {
        address: "1 Wale Street",
        assetType: "Industrial",
        status: "Off Market",
        wales: 7,             // a stale scan-time figure
        createdBy: "test",
      }),
    );
    return { t, staff, propertyId };
  }

  const yearsOut = (y: number) =>
    new Date(Date.now() + y * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  test("saving a schedule overwrites the stale figure", async () => {
    const { t, staff, propertyId } = await setup();

    await staff.mutation(api.properties.updatePropertyTenants, {
      id: propertyId,
      tenants: [
        { id: "t1", tenantName: "Tenant A", lettableArea: 1000, leaseEnd: yearsOut(3) },
      ],
    });

    const p = await t.run(async (ctx: any) => ctx.db.get(propertyId));
    expect(p.wales).not.toBe(7);          // the stale value is gone
    expect(p.wales).toBeCloseTo(3, 0);
  });

  test("all leases expired stores 0, not the old value", async () => {
    const { t, staff, propertyId } = await setup();

    await staff.mutation(api.properties.updatePropertyTenants, {
      id: propertyId,
      tenants: [
        { id: "t1", tenantName: "Gone", lettableArea: 900, leaseEnd: yearsOut(-1) },
      ],
    });

    const p = await t.run(async (ctx: any) => ctx.db.get(propertyId));
    expect(p.wales).toBe(0);
  });

  test("a schedule with no usable dates leaves the existing figure alone", async () => {
    const { t, staff, propertyId } = await setup();

    await staff.mutation(api.properties.updatePropertyTenants, {
      id: propertyId,
      tenants: [{ id: "t1", tenantName: "No dates", lettableArea: 500 }],
    });

    const p = await t.run(async (ctx: any) => ctx.db.get(propertyId));
    // Not computable — a hand-entered or IM-scanned WALE must survive.
    expect(p.wales).toBe(7);
  });

  test("clearing the schedule does not wipe the figure", async () => {
    const { t, staff, propertyId } = await setup();
    await staff.mutation(api.properties.updatePropertyTenants, { id: propertyId, tenants: [] });
    const p = await t.run(async (ctx: any) => ctx.db.get(propertyId));
    expect(p.wales).toBe(7);
  });
});
