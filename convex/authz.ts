import { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Ensures the caller is authenticated and has a 'staff' or 'admin' role in the users table.
 * Throws an error if not authorized.
 * Returns the verified user record and their identity.
 */
export async function requireStaffOrAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated call");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    throw new Error("User record not found");
  }

  if (user.role !== "staff" && user.role !== "admin") {
    throw new Error("Unauthorized: Insufficient permissions");
  }

  return { identity, user };
}

/**
 * Ensures the caller is authenticated.
 * Returns the verified user record and their identity.
 */
export async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated call");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    throw new Error("User record not found");
  }

  return { identity, user };
}
