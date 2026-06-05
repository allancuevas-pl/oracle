import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

export const getActivities = query({
  args: { recordId: v.string() },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);

    // Cap at 100 — newest first. More than enough for any active record's feed.
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_recordId", (q) => q.eq("recordId", args.recordId))
      .order("desc")
      .take(100);

    if (activities.length === 0) return [];

    // Deduplicate user lookups — an active brief could have 50+ entries from
    // only 2-3 people; no reason to hit the DB once per row.
    const uniqueClerkIds = [...new Set(activities.map((a) => a.createdBy))];
    const users = await Promise.all(
      uniqueClerkIds.map((clerkId) =>
        ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first()
      )
    );
    const userMap = new Map(
      users.filter(Boolean).map((u) => [
        u!.clerkId,
        `${u!.firstName || ""} ${u!.lastName || ""}`.trim() || u!.email || "Unknown",
      ])
    );

    return activities.map((activity) => ({
      ...activity,
      creatorName: userMap.get(activity.createdBy) ?? "Unknown User",
    }));
  },
});

export const addNote = mutation({
  args: {
    recordId: v.string(),
    recordType: v.union(v.literal("brief"), v.literal("property"), v.literal("client")),
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
  { recordId: string, recordType: "brief" | "property" | "client", content: string, metadata?: string, userId: string }
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
