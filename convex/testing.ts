import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const insertMockUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("staff"), v.literal("client"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      role: args.role,
    });
  },
});

/** Insert a comp directly for tests (bypasses the staff/admin gate). */
export const insertMockComp = internalMutation({
  args: {
    type: v.union(v.literal("lease"), v.literal("sale")),
    address: v.string(),
    suburb: v.string(),
    state: v.optional(v.string()),
    assetType: v.optional(v.string()),
    nlaSqm: v.optional(v.number()),
    landAreaSqm: v.optional(v.number()),
    saleDate: v.optional(v.string()),
    leaseDate: v.optional(v.string()),
    source: v.optional(v.union(
      v.literal("agent_call"),
      v.literal("real_commercial"),
      v.literal("loopnet"),
      v.literal("im_scan"),
      v.literal("comp_scan"),
      v.literal("historical_import"),
      v.literal("arealytics"),
      v.literal("property_lions"),
      v.literal("other"),
    )),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("comps", {
      ...args,
      source: args.source ?? "historical_import",
      verified: false,
      createdBy: "test",
    });
  },
});
