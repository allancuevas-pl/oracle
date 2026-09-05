import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

/**
 * Group F — the two things that could not be recorded or corrected.
 *
 *  - a brief's open date was written once at creation and never again
 *  - a match carried no timestamp at all, so "this hasn't moved in a month"
 *    was simply not answerable
 */

const modules = import.meta.glob("./**/*.*s");

async function staffClient() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "staff_1", email: "staff@test.com", role: "staff",
  });
  return { t, staff: t.withIdentity({ subject: "staff_1" }) };
}

describe("a brief's open date is correctable", () => {
  test("updateBrief accepts and stores a corrected startDate", async () => {
    // The mandate opened in June; the brief was entered in September.
    const { t, staff } = await staffClient();
    const id = await staff.mutation(api.briefs.createBrief, {
      clientName: "Backdated Co", stage: "Triage",
    });

    const created = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(created.startDate).toBeGreaterThan(0);   // still stamped on create

    const june = Date.parse("2026-06-15T00:00:00Z");
    await staff.mutation(api.briefs.updateBrief, { id, startDate: june });

    const after = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(after.startDate).toBe(june);
  });

  test("editing other fields leaves the open date alone", async () => {
    // updateBrief patches only the args it receives, so an edit that doesn't
    // mention the date must not clear it.
    const { t, staff } = await staffClient();
    const id = await staff.mutation(api.briefs.createBrief, {
      clientName: "Backdated Co", stage: "Triage",
    });
    const june = Date.parse("2026-06-15T00:00:00Z");
    await staff.mutation(api.briefs.updateBrief, { id, startDate: june });
    await staff.mutation(api.briefs.updateBrief, { id, priority: "High" });

    const after = await t.run(async (ctx: any) => ctx.db.get(id));
    expect(after.startDate).toBe(june);
    expect(after.priority).toBe("High");
  });
});

describe("a deal records when it last moved", () => {
  async function seedMatch() {
    const { t, staff } = await staffClient();
    const briefId = await staff.mutation(api.briefs.createBrief, {
      clientName: "Pipeline Co", stage: "Triage",
    });
    const propertyId = await staff.mutation(api.properties.createProperty, {
      address: "7 Stage Street", assetType: "Industrial", status: "Off Market" as const,
    });
    const matchId = await staff.mutation(api.matches.createMatch, {
      briefId, propertyId, status: "Shortlisted",
    });
    return { t, staff, matchId };
  }

  const stampOf = (t: any, id: any) =>
    t.run(async (ctx: any) => ctx.db.get(id).then((m: any) => m.statusChangedAt));

  test("a new match is stamped on creation", async () => {
    const { t, matchId } = await seedMatch();
    expect(await stampOf(t, matchId)).toBeGreaterThan(0);
  });

  test("moving stage re-stamps it", async () => {
    const { t, staff, matchId } = await seedMatch();
    await t.run(async (ctx: any) =>
      ctx.db.patch(matchId, { statusChangedAt: Date.parse("2026-01-01T00:00:00Z") }),
    );

    await staff.mutation(api.matches.updateMatch, { id: matchId, status: "Prepping" });

    expect(await stampOf(t, matchId)).toBeGreaterThan(Date.parse("2026-06-01T00:00:00Z"));
  });

  test("editing the notes does NOT re-stamp it", async () => {
    // The whole point of the flag is to surface deals nobody is moving.
    // If any save counted as movement, a stale deal could be hidden just by
    // someone opening it and re-saving a note.
    const { t, staff, matchId } = await seedMatch();
    const old = Date.parse("2026-01-01T00:00:00Z");
    await t.run(async (ctx: any) => ctx.db.patch(matchId, { statusChangedAt: old }));

    await staff.mutation(api.matches.updateMatch, { id: matchId, notes: "Called the agent." });

    expect(await stampOf(t, matchId)).toBe(old);
  });

  test("re-saving the SAME stage does not re-stamp it either", async () => {
    const { t, staff, matchId } = await seedMatch();
    const old = Date.parse("2026-01-01T00:00:00Z");
    await t.run(async (ctx: any) => ctx.db.patch(matchId, { statusChangedAt: old }));

    await staff.mutation(api.matches.updateMatch, { id: matchId, status: "Shortlisted" });

    expect(await stampOf(t, matchId)).toBe(old);
  });

  test("the backfill uses creation time, and is idempotent", async () => {
    // Existing rows have no record of when they last moved. Creation time is
    // the earliest defensible value: it makes an old deal look at least as
    // stale as it really is, rather than resetting the board to "just moved"
    // and hiding exactly the deals the flag exists to surface.
    const { t, matchId } = await seedMatch();
    await t.run(async (ctx: any) => ctx.db.patch(matchId, { statusChangedAt: undefined }));

    const first = await t.mutation(internal.migrations.backfillMatchStatusChangedAt, { dryRun: false });
    expect(first.updated).toBe(1);

    const row = await t.run(async (ctx: any) => ctx.db.get(matchId));
    expect(row.statusChangedAt).toBe(row._creationTime);

    const second = await t.mutation(internal.migrations.backfillMatchStatusChangedAt, { dryRun: false });
    expect(second.updated).toBe(0);
    expect(second.alreadySet).toBe(1);
  });
});
