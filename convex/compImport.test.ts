import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { compIdentityKey } from "./comps";

/**
 * The comp scanner had no duplicate check at all. Re-scanning an agent's table,
 * or scanning two workbook tabs that overlap, inserted everything again — and
 * it has already happened: 8 of the 142 live comps are redundant copies from
 * the 2026-07-28 import, including "21 Magnesium Street" three times.
 *
 * The hard part is not detecting duplicates, it is NOT over-detecting them. A
 * building routinely has several genuine tenancies leased in the same month.
 */

const modules = import.meta.glob("./**/*.*s");

const LEASE = {
  type: "lease" as const,
  address: "21 Magnesium Street",
  suburb: "Narangba",
  tenant: "Tyre Doctor Trading Pty",
  leaseDate: "2025-06-01",
  nlaSqm: 945,
  rentPa: 274995,
};

async function staffClient() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "staff_1", email: "staff@test.com", role: "staff",
  });
  return { t, staff: t.withIdentity({ subject: "staff_1" }) };
}

const countComps = (t: any) =>
  t.run(async (ctx: any) => ctx.db.query("comps").collect().then((r: any[]) => r.length));

describe("createComps — re-importing the same table", () => {
  test("importing the same comp twice inserts it once", async () => {
    const { t, staff } = await staffClient();

    const first = await staff.mutation(api.comps.createComps, { comps: [LEASE] });
    expect(first.created).toBe(1);

    const second = await staff.mutation(api.comps.createComps, { comps: [LEASE] });
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);

    expect(await countComps(t)).toBe(1);
  });

  test("a repeat inside one batch is caught too", async () => {
    // Overlapping workbook tabs produce this — the same lease on the "Leased"
    // sheet and again on a summary sheet.
    const { t, staff } = await staffClient();
    const res = await staff.mutation(api.comps.createComps, { comps: [LEASE, LEASE, LEASE] });
    expect(res.created).toBe(1);
    expect(res.skipped).toBe(2);
    expect(await countComps(t)).toBe(1);
  });

  test("the caller is told which addresses were skipped", async () => {
    // Silently importing 9 of 12 would be its own kind of lie.
    const { staff } = await staffClient();
    await staff.mutation(api.comps.createComps, { comps: [LEASE] });
    const res = await staff.mutation(api.comps.createComps, { comps: [LEASE] });
    expect(res.skippedAddresses).toEqual(["21 Magnesium Street"]);
  });
});

describe("what must NOT be treated as a duplicate", () => {
  /**
   * Over-matching silently discards real evidence, which is worse than a
   * duplicate an analyst can see and delete. These are the live cases that
   * would break under a looser key.
   */
  test("two genuine tenancies at one address in the same month", async () => {
    // 21 Magnesium Street really does hold a 945sqm and a 950sqm record.
    const { t, staff } = await staffClient();
    const res = await staff.mutation(api.comps.createComps, {
      comps: [LEASE, { ...LEASE, nlaSqm: 950, rentPa: 275000 }],
    });
    expect(res.created).toBe(2);
    expect(await countComps(t)).toBe(2);
  });

  test("different tenants at the same address, same date and size", async () => {
    const { staff } = await staffClient();
    const res = await staff.mutation(api.comps.createComps, {
      comps: [LEASE, { ...LEASE, tenant: "Janus International Australia Pty Ltd" }],
    });
    expect(res.created).toBe(2);
  });

  test("the same premises re-leased later is a new comp", async () => {
    const { staff } = await staffClient();
    await staff.mutation(api.comps.createComps, { comps: [LEASE] });
    const res = await staff.mutation(api.comps.createComps, {
      comps: [{ ...LEASE, leaseDate: "2028-06-01", rentPa: 310000 }],
    });
    expect(res.created).toBe(1);
  });

  test("a sale and a lease at the same address are different evidence", async () => {
    const { staff } = await staffClient();
    const res = await staff.mutation(api.comps.createComps, {
      comps: [
        LEASE,
        { type: "sale" as const, address: LEASE.address, suburb: LEASE.suburb,
          saleDate: "2025-06-01", nlaSqm: 945, salePrice: 4000000 },
      ],
    });
    expect(res.created).toBe(2);
  });

  test("the same address in a different suburb is a different property", async () => {
    const { staff } = await staffClient();
    const res = await staff.mutation(api.comps.createComps, {
      comps: [LEASE, { ...LEASE, suburb: "Sumner" }],
    });
    expect(res.created).toBe(2);
  });
});

describe("compIdentityKey", () => {
  test("ignores capitalisation and stray whitespace", () => {
    // The same lease typed by two people, or scanned from two layouts.
    expect(compIdentityKey({ ...LEASE, address: "  21  MAGNESIUM   Street " }))
      .toBe(compIdentityKey(LEASE));
  });

  test("a missing tenant is not the same as a named one", () => {
    // 144 Lavarack Avenue has exactly this: three rows, one with no tenant.
    // They may well be the same lease, but the import cannot know that — an
    // analyst has to decide, so both are kept.
    expect(compIdentityKey({ ...LEASE, tenant: undefined }))
      .not.toBe(compIdentityKey(LEASE));
  });

  test("a numeric 0 is not treated as absent", () => {
    // The falsy-zero family again: a 0 must key distinctly from undefined.
    expect(compIdentityKey({ ...LEASE, rentPa: 0 }))
      .not.toBe(compIdentityKey({ ...LEASE, rentPa: undefined }));
  });
});

describe("dates are normalised on the way in", () => {
  test("a junk lease date is cleared and preserved in notes", async () => {
    // End-to-end through the real mutation: this is how "Upon Completion" got
    // into the table in the first place.
    const { t, staff } = await staffClient();
    await staff.mutation(api.comps.createComps, {
      comps: [{ ...LEASE, leaseDate: "Upon Completion" }],
    });

    const comp = await t.run(async (ctx: any) => ctx.db.query("comps").first());
    expect(comp.leaseDate).toBeUndefined();
    expect(comp.notes).toContain("Upon Completion");
  });

  test("a slashed date is stored as ISO so the recency filter works", async () => {
    const { t, staff } = await staffClient();
    await staff.mutation(api.comps.createComps, {
      comps: [{ ...LEASE, leaseDate: "01/07/2025" }],
    });
    const comp = await t.run(async (ctx: any) => ctx.db.query("comps").first());
    expect(comp.leaseDate).toBe("2025-07-01");
  });

  test("editing a comp normalises its date too", async () => {
    // The form is a text input; a hand-typed value needs the same treatment.
    const { t, staff } = await staffClient();
    await staff.mutation(api.comps.createComps, { comps: [LEASE] });
    const comp = await t.run(async (ctx: any) => ctx.db.query("comps").first());

    await staff.mutation(api.comps.updateComp, {
      id: comp._id, address: LEASE.address, suburb: LEASE.suburb, leaseDate: "TBC",
    });

    const after = await t.run(async (ctx: any) => ctx.db.get(comp._id));
    expect(after.leaseDate).toBeUndefined();
    expect(after.notes).toContain("TBC");
  });

  test("an edit does not wipe notes that were already there", async () => {
    // normaliseCompDateFields seeds from the stored record for exactly this.
    const { t, staff } = await staffClient();
    await staff.mutation(api.comps.createComps, {
      comps: [{ ...LEASE, notes: "Agent confirmed net rent." }],
    });
    const comp = await t.run(async (ctx: any) => ctx.db.query("comps").first());

    await staff.mutation(api.comps.updateComp, {
      id: comp._id, address: LEASE.address, suburb: LEASE.suburb, leaseDate: "Upon Completion",
    });

    const after = await t.run(async (ctx: any) => ctx.db.get(comp._id));
    expect(after.notes).toContain("Agent confirmed net rent.");
    expect(after.notes).toContain("Upon Completion");
  });
});

/**
 * C3 — concurrent edits. NOT FIXED; this documents the exposure so it is
 * provable rather than theoretical, and so the day someone adds conflict
 * detection this test fails loudly and gets updated.
 *
 * Every edit modal loads the whole record and submits every field, so two
 * people with the same record open don't merge — the second save carries the
 * first's fields at their pre-edit values and silently reverts them. Convex
 * transactions are not the issue: each mutation is atomic, the stale payload is.
 *
 * Fixing it properly needs a version/updatedAt on `properties` (there is none
 * today) plus a "someone else changed this" path in the UI. Sending only
 * react-hook-form's dirty fields is the cheaper option but risks silently
 * dropping an edit if dirty-tracking ever misses one — which is the same
 * failure it is meant to prevent.
 */
describe("KNOWN, UNFIXED: a second full-form save reverts the first", () => {
  test("two staff editing different fields — one edit is lost", async () => {
    const { t, staff } = await staffClient();
    const id = await staff.mutation(api.properties.createProperty, {
      address: "9 Concurrent Way",
      assetType: "Industrial",
      status: "Off Market" as const,
      askingPrice: 5_000_000,
    });

    // Both modals load the same snapshot.
    const snapshot = await t.run(async (ctx: any) => ctx.db.get(id));

    // Staff A edits the address and saves.
    await staff.mutation(api.properties.updateProperty, {
      id, address: "9 Concurrent Way, Unit 2",
      assetType: snapshot.assetType, askingPrice: snapshot.askingPrice,
    });

    // Staff B, still holding the old snapshot, edits only the price and saves.
    await staff.mutation(api.properties.updateProperty, {
      id, address: snapshot.address,
      assetType: snapshot.assetType, askingPrice: 5_500_000,
    });

    const final = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(final.askingPrice).toBe(5_500_000);          // B's edit landed
    expect(final.address).toBe("9 Concurrent Way");     // A's edit is GONE
  });
});
