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

    if (!existingUser) {
      const email = (identity.email || "").toLowerCase();

      // Check for a pending invitation — lets invited users get the correct role
      const pendingInvite = email
        ? await ctx.db
            .query("pendingInvitations")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first()
        : null;

      await ctx.db.insert("users", {
        clerkId: identity.subject,
        email,
        firstName: identity.givenName || "",
        lastName: identity.familyName || "",
        // Use invited role when present; fallback to "client" (no access) for
        // any unanticipated sign-up. Admins must explicitly invite with a role.
        role: pendingInvite?.role ?? "client",
      });

      // Consume the invitation record — it's single-use
      if (pendingInvite) {
        await ctx.db.delete(pendingInvite._id);
      }
    }
  },
});
