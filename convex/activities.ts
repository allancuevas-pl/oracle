import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

export const getActivities = query({
  args: { recordId: v.string() },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_recordId", (q) => q.eq("recordId", args.recordId))
      .order("desc") // newest first
      .collect();

    const enrichedActivities = await Promise.all(
      activities.map(async (activity) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", activity.createdBy))
          .first();
        
        return {
          ...activity,
          creatorName: user 
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email 
            : "Unknown User"
        };
      })
    );

    return enrichedActivities;
  },
});

export const addNote = mutation({
  args: {
    recordId: v.string(),
    recordType: v.union(v.literal("brief"), v.literal("property")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);

    await ctx.db.insert("activities", {
      recordId: args.recordId,
      recordType: args.recordType,
      type: "note",
      content: args.content,
      createdBy: identity.subject,
    });
  },
});

// Helper for internal use by other mutations (not exported as an API endpoint)
export async function logSystemActivity(
  ctx: any, 
  { recordId, recordType, content, metadata, userId }: 
  { recordId: string, recordType: "brief" | "property", content: string, metadata?: string, userId: string }
) {
  await ctx.db.insert("activities", {
    recordId,
    recordType,
    type: "system",
    content,
    metadata,
    createdBy: userId,
  });
}
