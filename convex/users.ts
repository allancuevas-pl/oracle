import { query, mutation } from "./_generated/server";
import { requireAuthenticatedUser, requireStaffOrAdmin } from "./authz";

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

// Returns all staff and admin users — used for the assignee picker on briefs
export const getUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.filter(u => u.role === "staff" || u.role === "admin");
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
      await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email || "",
        firstName: identity.givenName || "",
        lastName: identity.familyName || "",
        role: "admin", // Auto-admin for local dev
      });
    }
  },
});
