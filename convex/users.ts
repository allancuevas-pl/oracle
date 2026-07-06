import { query, mutation } from "./_generated/server";
import { requireStaffOrAdmin } from "./authz";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

// Returns all staff and admin users — used for the assignee picker on briefs.
// Two index scans (one per role) instead of a full table scan + filter.
export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const [admins, staff] = await Promise.all([
      ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(100),
      ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "staff")).take(100),
    ]);
    return [...admins, ...staff];
  },
});

export const storeUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    const email = (identity.email || "").toLowerCase();

    // Check for a pending invitation regardless of whether user record exists.
    // Admins re-invite existing users to change their role — we must apply it
    // on sign-in even when the user row already exists.
    const pendingInvite = email
      ? await ctx.db
          .query("pendingInvitations")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;

    if (!existingUser) {
      await ctx.db.insert("users", {
        clerkId: identity.subject,
        email,
        firstName: identity.givenName || "",
        lastName: identity.familyName || "",
        // Use invited role when present; fallback to "blocked" — zero access
        // anywhere — for uninvited sign-ups. Admins must explicitly invite.
        role: pendingInvite?.role ?? "blocked",
      });
    } else if (pendingInvite) {
      // Existing user being re-invited with a new role — apply it immediately,
      // EXCEPT a client-portal invite must never demote a CRM user (e.g. a client
      // record created with an admin's email). Team invites are explicit & allowed.
      const wouldDemoteCrmUser =
        pendingInvite.role === "client" &&
        (existingUser.role === "staff" || existingUser.role === "admin");
      if (!wouldDemoteCrmUser) {
        await ctx.db.patch(existingUser._id, { role: pendingInvite.role });
      }
    }

    // Consume the invitation — single-use
    if (pendingInvite) {
      await ctx.db.delete(pendingInvite._id);
    }
  },
});
