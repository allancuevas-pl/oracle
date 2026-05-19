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
