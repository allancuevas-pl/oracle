import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

/**
 * Group B — role assignment and access revocation.
 *
 * Every rule in CLAUDE.md §6 exists because getting it wrong hands someone
 * access they shouldn't have, and until now not one of them had a test. The
 * guards were written carefully; that is not the same as being verified.
 *
 * The load-bearing rules under test:
 *   - an uninvited sign-up is `blocked`, never `client`
 *   - a client-portal invite must never demote a CRM user
 *   - removing a team member sets `blocked`, never `client`
 *   - revoking access actually closes the portal, token in hand or not
 */

const modules = import.meta.glob("./**/*.*s");

function identityFor(clerkId: string, email: string) {
  return { subject: clerkId, email };
}

describe("storeUser — who gets a role on first sign-in", () => {
  test("an uninvited sign-up is blocked, not client", async () => {
    // The single most important line in the auth code. Defaulting to "client"
    // here would give any stranger who finds the sign-up page a portal account.
    const t = convexTest(schema, modules);
    await t
      .withIdentity(identityFor("stranger_1", "stranger@example.com"))
      .mutation(api.users.storeUser, {});

    const user = await t.run(async (ctx: any) =>
      ctx.db.query("users").withIndex("by_clerkId", (q: any) => q.eq("clerkId", "stranger_1")).first(),
    );
    expect(user.role).toBe("blocked");
  });

  test("a pending invitation grants exactly the invited role", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) =>
      ctx.db.insert("pendingInvitations", {
        email: "newstaff@test.com", role: "staff", invitedBy: "admin_1",
      }),
    );

    await t
      .withIdentity(identityFor("newstaff_1", "newstaff@test.com"))
      .mutation(api.users.storeUser, {});

    const user = await t.run(async (ctx: any) =>
      ctx.db.query("users").withIndex("by_clerkId", (q: any) => q.eq("clerkId", "newstaff_1")).first(),
    );
    expect(user.role).toBe("staff");
  });

  test("an invitation is single-use — it is consumed on sign-in", async () => {
    // Otherwise a leaked invite email keeps granting the role forever.
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) =>
      ctx.db.insert("pendingInvitations", {
        email: "once@test.com", role: "staff", invitedBy: "admin_1",
      }),
    );

    await t.withIdentity(identityFor("once_1", "once@test.com")).mutation(api.users.storeUser, {});

    const remaining = await t.run(async (ctx: any) =>
      ctx.db.query("pendingInvitations").collect(),
    );
    expect(remaining).toHaveLength(0);
  });

  test("an invite is matched case-insensitively", async () => {
    // Clerk hands back whatever case the user typed; the invite is stored
    // lowercased. A mismatch would silently drop the invited user to blocked.
    const t = convexTest(schema, modules);
    await t.run(async (ctx: any) =>
      ctx.db.insert("pendingInvitations", {
        email: "mixed@test.com", role: "admin", invitedBy: "admin_1",
      }),
    );

    await t
      .withIdentity(identityFor("mixed_1", "Mixed@Test.COM"))
      .mutation(api.users.storeUser, {});

    const user = await t.run(async (ctx: any) =>
      ctx.db.query("users").withIndex("by_clerkId", (q: any) => q.eq("clerkId", "mixed_1")).first(),
    );
    expect(user.role).toBe("admin");
  });
});

describe("a client-portal invite must never demote a CRM user", () => {
  /**
   * The scenario: staff add a client record using an email that already
   * belongs to an admin or agent. That fires a portal invite. Without the
   * guard, the admin's next sign-in strips them to `client` and locks them out
   * of the CRM they administer.
   */
  async function withExistingUser(role: "admin" | "staff" | "client") {
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "existing_1", email: "boss@test.com", role,
    });
    await t.run(async (ctx: any) =>
      ctx.db.insert("pendingInvitations", {
        email: "boss@test.com", role: "client", invitedBy: "admin_1",
      }),
    );
    return t;
  }

  const roleOf = (t: any) =>
    t.run(async (ctx: any) =>
      ctx.db
        .query("users")
        .withIndex("by_clerkId", (q: any) => q.eq("clerkId", "existing_1"))
        .first()
        .then((u: any) => u.role),
    );

  test("storeUser: an admin stays an admin", async () => {
    const t = await withExistingUser("admin");
    await t.withIdentity(identityFor("existing_1", "boss@test.com")).mutation(api.users.storeUser, {});
    expect(await roleOf(t)).toBe("admin");
  });

  test("storeUser: a staff member stays staff", async () => {
    const t = await withExistingUser("staff");
    await t.withIdentity(identityFor("existing_1", "boss@test.com")).mutation(api.users.storeUser, {});
    expect(await roleOf(t)).toBe("staff");
  });

  test("upsertUserRole: the same guard holds on the invite-time path", async () => {
    // storeUser fires on sign-in; upsertUserRole fires immediately when the
    // invite is sent. Both need the guard — a hole in either one is a hole.
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "existing_1", email: "boss@test.com", role: "admin",
    });
    await t.mutation(internal.team.upsertUserRole, { email: "boss@test.com", role: "client" });
    expect(await roleOf(t)).toBe("admin");
  });

  test("but a deliberate team invite still changes the role", async () => {
    // The guard must be narrow. Promoting staff -> admin is an explicit act by
    // an admin and has to keep working.
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "existing_1", email: "boss@test.com", role: "staff",
    });
    await t.mutation(internal.team.upsertUserRole, { email: "boss@test.com", role: "admin" });
    expect(await roleOf(t)).toBe("admin");
  });

  test("a genuine client is not protected by the guard", async () => {
    // Only staff/admin are shielded. Re-inviting a real client must work.
    const t = await withExistingUser("client");
    await t.withIdentity(identityFor("existing_1", "boss@test.com")).mutation(api.users.storeUser, {});
    expect(await roleOf(t)).toBe("client");
  });
});

describe("removeMember — revoking access", () => {
  async function setup() {
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "admin_1", email: "admin@test.com", role: "admin",
    });
    const targetId = await t.mutation(internal.testing.insertMockUser, {
      clerkId: "agent_1", email: "agent@test.com", role: "staff",
    });
    const adminId = await t.run(async (ctx: any) =>
      ctx.db.query("users").withIndex("by_clerkId", (q: any) => q.eq("clerkId", "admin_1")).first()
        .then((u: any) => u._id),
    );
    return { t, admin: t.withIdentity({ subject: "admin_1" }), targetId, adminId };
  }

  test("sets blocked, never client", async () => {
    // "client" would let a removed agent straight back in via the portal.
    const { t, admin, targetId } = await setup();
    await admin.mutation(api.team.removeMember, { userId: targetId });
    const user = await t.run(async (ctx: any) => ctx.db.get(targetId));
    expect(user.role).toBe("blocked");
    expect(user.role).not.toBe("client");
  });

  test("an admin cannot remove themselves", async () => {
    const { admin, adminId } = await setup();
    await expect(admin.mutation(api.team.removeMember, { userId: adminId })).rejects.toThrow(
      "Cannot remove yourself",
    );
  });

  test("staff cannot remove anyone — admin only", async () => {
    const { t, targetId } = await setup();
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "staff_2", email: "staff2@test.com", role: "staff",
    });
    await expect(
      t.withIdentity({ subject: "staff_2" }).mutation(api.team.removeMember, { userId: targetId }),
    ).rejects.toThrow("Admin access required");
  });

  test("a blocked user is locked out of the CRM", async () => {
    const { t, admin, targetId } = await setup();
    await admin.mutation(api.team.removeMember, { userId: targetId });
    await expect(
      t.withIdentity({ subject: "agent_1" }).query(api.properties.getProperties, {}),
    ).rejects.toThrow("Unauthorized");
  });

  test("a blocked user is locked out of the portal too", async () => {
    // The side door: blocked must fail the `role === "client"` check as well.
    const { t, admin, targetId } = await setup();
    await admin.mutation(api.team.removeMember, { userId: targetId });
    const portal = await t
      .withIdentity({ subject: "agent_1" })
      .query(api.clientPortal.getMyPortalData, {});
    expect(portal).toBeNull();
  });
});

describe("a revoked client cannot reuse a report token", () => {
  /**
   * Report links are long-lived and land in a client's inbox. Revoking portal
   * access has to close the door on links already sent, not just on new ones.
   */
  async function setup() {
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "admin_1", email: "admin@test.com", role: "admin",
    });
    const clientUserId = await t.mutation(internal.testing.insertMockUser, {
      clerkId: "client_1", email: "buyer@test.com", role: "client",
    });
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: "buyer@test.com", token: "tok_live",
    });
    const client = t.withIdentity(identityFor("client_1", "buyer@test.com"));
    return { t, admin: t.withIdentity({ subject: "admin_1" }), client, clientUserId };
  }

  test("the token works while access is live — the control", async () => {
    // Without this the revocation assertion below could pass vacuously.
    const { client } = await setup();
    const report = await client.query(api.clientPortal.getMyReport, { token: "tok_live" });
    expect(report).not.toBeNull();
    expect(report!.property.address).toBe("1 Vault Street");
  });

  test("the same token returns nothing once access is revoked", async () => {
    const { admin, client, clientUserId } = await setup();
    await admin.mutation(api.team.removeMember, { userId: clientUserId });
    expect(await client.query(api.clientPortal.getMyReport, { token: "tok_live" })).toBeNull();
  });

  test("another client's token is refused even while signed in", async () => {
    const { t, client } = await setup();
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: "someone.else@test.com", token: "tok_other",
    });
    expect(await client.query(api.clientPortal.getMyReport, { token: "tok_other" })).toBeNull();
  });
});

describe("duplicate user rows — one email, two Clerk identities", () => {
  /**
   * Three live emails already have two `users` rows, created when someone
   * signed in a second way (Google after a password account). `storeUser`
   * keys off clerkId, so a second identity makes a second row — while every
   * role path resolves by email.
   *
   * Taking `.first()` there was a real hole: revoking a client blocked one row
   * and left the other a live client. These tests pin the fix.
   */
  test("signing in a second way still creates a second users row", async () => {
    // Not fixed here, and deliberately so: adopting the existing row would
    // mean trusting Clerk's email claim to be verified. The rows are made
    // harmless instead, by having every role write cover all of them.
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "pw_identity", email: "dual@test.com", role: "admin",
    });

    await t
      .withIdentity(identityFor("google_identity", "dual@test.com"))
      .mutation(api.users.storeUser, {});

    const rows = await t.run(async (ctx: any) =>
      ctx.db.query("users").withIndex("by_email", (q: any) => q.eq("email", "dual@test.com")).collect(),
    );
    expect(rows).toHaveLength(2);
    // The new row is `blocked`, never inheriting the admin role — an unverified
    // email claim must not be an escalation path.
    expect(rows.find((r: any) => r.clerkId === "google_identity").role).toBe("blocked");
  });

  test("revoking access blocks EVERY identity for that email", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_a", email: "dual@test.com", role: "client",
    });
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_b", email: "dual@test.com", role: "client",
    });
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "admin_1", email: "admin@test.com", role: "admin",
    });
    const admin = t.withIdentity({ subject: "admin_1" });

    // Exactly what the client-record UI does: read the status, revoke that id.
    const status = await admin.query(api.team.getClientPortalStatus, { email: "dual@test.com" });
    await admin.mutation(api.team.removeMember, { userId: status.account!._id });

    const roles = await t.run(async (ctx: any) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", "dual@test.com"))
        .collect()
        .then((rows: any[]) => rows.map((r) => r.role).sort()),
    );
    expect(roles).toEqual(["blocked", "blocked"]);
  });

  test("neither identity can open the report after a revoke", async () => {
    // The exploit, made concrete: before the fix the user simply signed in with
    // their other method and the deal was still there.
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "admin_1", email: "admin@test.com", role: "admin",
    });
    const rowA = await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_a", email: "buyer@test.com", role: "client",
    });
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_b", email: "buyer@test.com", role: "client",
    });
    await t.mutation(internal.testing.seedPortalDeal, {
      clientEmail: "buyer@test.com", token: "tok_dual",
    });

    const identityA = t.withIdentity(identityFor("identity_a", "buyer@test.com"));
    const identityB = t.withIdentity(identityFor("identity_b", "buyer@test.com"));
    // Control: both could read it before the revoke.
    expect(await identityB.query(api.clientPortal.getMyReport, { token: "tok_dual" })).not.toBeNull();

    await t.withIdentity({ subject: "admin_1" }).mutation(api.team.removeMember, { userId: rowA });

    expect(await identityA.query(api.clientPortal.getMyReport, { token: "tok_dual" })).toBeNull();
    expect(await identityB.query(api.clientPortal.getMyReport, { token: "tok_dual" })).toBeNull();
  });

  test("a promotion also reaches every row", async () => {
    // The flip side of the same bug: promote someone with two rows and one row
    // stayed blocked, so their access depended on how they happened to sign in.
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_a", email: "agent@test.com", role: "blocked",
    });
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_b", email: "agent@test.com", role: "blocked",
    });

    await t.mutation(internal.team.upsertUserRole, { email: "agent@test.com", role: "staff" });

    const roles = await t.run(async (ctx: any) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", "agent@test.com"))
        .collect()
        .then((rows: any[]) => rows.map((r) => r.role)),
    );
    expect(roles).toEqual(["staff", "staff"]);
  });

  test("the demote guard still holds per row, even among duplicates", async () => {
    // A client invite reaching an email that has one admin row and one client
    // row must leave the admin row alone and still update the client row.
    const t = convexTest(schema, modules);
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_a", email: "boss@test.com", role: "admin",
    });
    await t.mutation(internal.testing.insertMockUser, {
      clerkId: "identity_b", email: "boss@test.com", role: "blocked",
    });

    await t.mutation(internal.team.upsertUserRole, { email: "boss@test.com", role: "client" });

    const roles = await t.run(async (ctx: any) =>
      ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", "boss@test.com"))
        .collect()
        .then((rows: any[]) => rows.map((r) => r.role).sort()),
    );
    expect(roles).toEqual(["admin", "client"]);
  });
});
