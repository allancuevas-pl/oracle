import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth.config";

export const getActivities = query({
  args: { recordId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_recordId", (q) => q.eq("recordId", args.recordId))
      .order("desc") // newest first
      .collect();

    return activities;
  },
});

export const addNote = mutation({
  args: {
    recordId: v.string(),
    recordType: v.union(v.literal("brief"), v.literal("property")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.insert("activities", {
      recordId: args.recordId,
      recordType: args.recordType,
      type: "note",
      content: args.content,
      createdBy: userId,
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
