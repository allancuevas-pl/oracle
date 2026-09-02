import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

/**
 * Access-control tests for the client portal's single-deal view.
 *
 * `getMyReport` now carries deal-vault documents, which are the most sensitive
 * thing the portal has ever returned — loan papers, legal records. The rules
 * below are the ones that keep them from reaching the wrong person, so they
 * are tested from the deny side first.
 *
 * The check used to be skipped entirely when a brief had no `clientId`, and
 * 4 of 8 live briefs were in exactly that state. "brief with no client link"
 * below is the regression test for that.
 */

const modules = import.meta.glob("./**/*.*s");

const OWNER = "owner@client.com";
const OTHER = "someone.else@client.com";
const TOKEN = "test-token-0001";

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "client_owner", email: OWNER, role: "client",
  });
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "client_other", email: OTHER, role: "client",
  });
  await t.mutation(internal.testing.insertMockUser, {
    clerkId: "staff_1", email: "staff@test.com", role: "staff",
  });
  return t;
}

const as = (t: any, subject: string, email: string) =>
  t.withIdentity({ subject, email });

/**
 * Add deal-vault files with real stored blobs, so ctx.storage.getUrl() resolves
 * and the query returns them — an unstored id yields a null url that the query
 * filters out, which would make a passing test meaningless.
 */
async function addFiles(
  t: any,
  propertyId: any,
  files: Array<{ fileName: string; visibility: "internal" | "client" }>,
) {
  await t.run(async (ctx: any) => {
    for (const f of files) {
      const storageId = await ctx.storage.store(new Blob(["test-content"]));
      await ctx.db.insert("dealFiles", {
        propertyId,
        storageId,
        fileName: f.fileName,
        visibility: f.visibility,
        uploadedBy: "test",
        uploadedAt: Date.now(),
      });
    }
  });
}

describe("getMyReport — who can see a deal", () => {
  test("the owning client can", async () => {
    const t = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });

    const res = await as(t, "client_owner", OWNER).query(api.clientPortal.getMyReport, {
      token: TOKEN,
    });

    expect(res).not.toBeNull();
    expect(res!.property?.address).toBe("1 Vault Street");
  });

  test("a different client holding the token cannot", async () => {
    const t = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });

    const res = await as(t, "client_other", OTHER).query(api.clientPortal.getMyReport, {
      token: TOKEN,
    });

    expect(res).toBeNull();
  });

  test("a brief with no client link denies everyone — fails closed", async () => {
    const t = await setup();
    // No clientEmail => brief.clientId is undefined. The previous version
    // skipped verification here and returned the whole report.
    await t.mutation(internal.testing.seedPortalDeal, { token: TOKEN });

    for (const [subject, email] of [["client_owner", OWNER], ["client_other", OTHER]]) {
      const res = await as(t, subject, email).query(api.clientPortal.getMyReport, {
        token: TOKEN,
      });
      expect(res).toBeNull();
    }
  });

  test("a staff user is not a portal client", async () => {
    const t = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });

    const res = await as(t, "staff_1", "staff@test.com").query(
      api.clientPortal.getMyReport, { token: TOKEN }
    );

    expect(res).toBeNull();
  });

  test("an unauthenticated caller gets nothing", async () => {
    const t = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });

    const res = await t.query(api.clientPortal.getMyReport, { token: TOKEN });
    expect(res).toBeNull();
  });

  test("an unknown token gets nothing", async () => {
    const t = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });

    const res = await as(t, "client_owner", OWNER).query(api.clientPortal.getMyReport, {
      token: "not-a-real-token",
    });
    expect(res).toBeNull();
  });
});

describe("getMyReport — which documents come back", () => {
  test("internal deal-vault files never reach the client", async () => {
    const t = await setup();
    const { propertyId } = await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });
    await addFiles(t, propertyId, [
      { fileName: "shared-brochure.pdf", visibility: "client" },
      { fileName: "loan-papers-CONFIDENTIAL.pdf", visibility: "internal" },
    ]);

    const res = await as(t, "client_owner", OWNER).query(api.clientPortal.getMyReport, {
      token: TOKEN,
    });

    expect(res).not.toBeNull();
    const names = (res!.files ?? []).map((f: any) => f.fileName);
    // The client-visible one comes through...
    expect(names).toContain("shared-brochure.pdf");
    // ...and the internal one must not appear at all — not as a row, not as
    // metadata anywhere in the payload.
    expect(names).not.toContain("loan-papers-CONFIDENTIAL.pdf");
    expect(JSON.stringify(res)).not.toContain("CONFIDENTIAL");
  });

  test("a denied caller gets no files at all", async () => {
    const t = await setup();
    const { propertyId } = await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });
    await addFiles(t, propertyId, [
      { fileName: "shared-brochure.pdf", visibility: "client" },
    ]);

    const res = await as(t, "client_other", OTHER).query(api.clientPortal.getMyReport, {
      token: TOKEN,
    });

    expect(res).toBeNull();
  });

  test("the response always carries a files array", async () => {
    const t = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: OWNER, token: TOKEN,
    });

    const res = await as(t, "client_owner", OWNER).query(api.clientPortal.getMyReport, {
      token: TOKEN,
    });

    expect(Array.isArray(res!.files)).toBe(true);
  });
});
