import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

/**
 * Regression tests for the Comps browse filters.
 *
 * These exist because the secondary filters (state / asset type / recency /
 * size) used to run in the BROWSER over whatever pages had been loaded. At ~95
 * comps every row was loaded, so it looked correct. At ~260k it silently
 * returned near-empty results — a match sitting at row 200 was invisible behind
 * a 50-row page. The tests below deliberately bury matching rows past the first
 * page, which is exactly the case the old client-side code got wrong.
 */

const modules = import.meta.glob("./**/*.*s");

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "staff_1",
    email: "staff@test.com",
    role: "staff",
  });
  return { t, staff: t.withIdentity({ subject: "staff_1" }) };
}

const page = { numItems: 10, cursor: null };

describe("comps secondary filters (server-side)", () => {
  test("finds matches buried past the first page", async () => {
    const { t, staff } = await setup();

    // 120 NSW rows first, then 3 VIC rows. With a 10-row page and client-side
    // filtering, the VIC rows would never be seen.
    for (let i = 0; i < 120; i++) {
      await t.mutation(internal.testing.insertMockComp, {
        type: "sale", address: `${i} Filler St`, suburb: "Filler", state: "NSW",
      });
    }
    for (let i = 0; i < 3; i++) {
      await t.mutation(internal.testing.insertMockComp, {
        type: "sale", address: `${i} Target Rd`, suburb: "Thomastown", state: "VIC",
      });
    }

    const res = await staff.query(api.comps.getCompsPaginated, {
      paginationOpts: page,
      state: "VIC",
    });

    expect(res.page).toHaveLength(3);
    expect(res.page.every((c) => c.state === "VIC")).toBe(true);
    expect(res.isDone).toBe(true);
  });

  test("assetTypes matches any of the selected types", async () => {
    const { t, staff } = await setup();
    for (const at of ["Industrial", "Retail", "Office"]) {
      await t.mutation(internal.testing.insertMockComp, {
        type: "sale", address: `1 ${at} Way`, suburb: "X", state: "VIC", assetType: at,
      });
    }

    const res = await staff.query(api.comps.getCompsPaginated, {
      paginationOpts: page,
      assetTypes: ["Industrial", "Office"],
    });

    expect(res.page.map((c) => c.assetType).sort()).toEqual(["Industrial", "Office"]);
  });

  test("dateFrom uses leaseDate for leases and saleDate for sales", async () => {
    const { t, staff } = await setup();
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "recent sale", suburb: "X", saleDate: "2026-06-01",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "old sale", suburb: "X", saleDate: "2019-01-01",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "lease", address: "recent lease", suburb: "X", leaseDate: "2026-06-01",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "lease", address: "old lease", suburb: "X", leaseDate: "2019-01-01",
    });
    // No date at all — must be excluded, matching the old `!date → drop` rule.
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "undated sale", suburb: "X",
    });

    const res = await staff.query(api.comps.getCompsPaginated, {
      paginationOpts: page,
      dateFrom: "2026-01-01",
    });

    expect(res.page.map((c) => c.address).sort()).toEqual(["recent lease", "recent sale"]);
  });

  test("size bands exclude comps missing the field", async () => {
    const { t, staff } = await setup();
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "in band", suburb: "X", nlaSqm: 500,
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "too big", suburb: "X", nlaSqm: 5000,
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "no nla", suburb: "X",
    });

    const res = await staff.query(api.comps.getCompsPaginated, {
      paginationOpts: page,
      nlaMin: 100,
      nlaMax: 1000,
    });

    expect(res.page.map((c) => c.address)).toEqual(["in band"]);
  });

  test("filters compose with the source/type index", async () => {
    const { t, staff } = await setup();
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "match", suburb: "X", state: "VIC", source: "arealytics",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "lease", address: "wrong type", suburb: "X", state: "VIC", source: "arealytics",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "wrong state", suburb: "X", state: "NSW", source: "arealytics",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "wrong source", suburb: "X", state: "VIC", source: "im_scan",
    });

    const res = await staff.query(api.comps.getCompsPaginated, {
      paginationOpts: page,
      type: "sale",
      source: "arealytics",
      state: "VIC",
    });

    expect(res.page.map((c) => c.address)).toEqual(["match"]);
  });

  test("search results honour the same filters", async () => {
    const { t, staff } = await setup();
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "12 Pacific Highway", suburb: "X", state: "VIC",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "99 Pacific Highway", suburb: "X", state: "NSW",
    });

    const res = await staff.query(api.comps.searchComps, {
      paginationOpts: page,
      query: "Pacific Highway",
      state: "VIC",
    });

    expect(res.page.map((c) => c.address)).toEqual(["12 Pacific Highway"]);
  });

  test("no filters returns everything (unfiltered path unchanged)", async () => {
    const { t, staff } = await setup();
    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.testing.insertMockComp, {
        type: "sale", address: `${i} Any St`, suburb: "X", state: "NSW",
      });
    }
    const res = await staff.query(api.comps.getCompsPaginated, { paginationOpts: page });
    expect(res.page).toHaveLength(5);
  });
});

describe("getComps (property-side matcher)", () => {
  test("returns suburb matches narrowed by assetType + type", async () => {
    const { t, staff } = await setup();
    await t.mutation(internal.testing.insertMockComp, {
      type: "lease", address: "match", suburb: "Blaxland", assetType: "Industrial",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "sale", address: "wrong type", suburb: "Blaxland", assetType: "Industrial",
    });
    await t.mutation(internal.testing.insertMockComp, {
      type: "lease", address: "wrong suburb", suburb: "Elsewhere", assetType: "Industrial",
    });

    const res = await staff.query(api.comps.getComps, {
      suburb: "Blaxland",
      assetType: "Industrial",
      type: "lease",
    });

    expect(res.map((c) => c.address)).toEqual(["match"]);
  });
});
