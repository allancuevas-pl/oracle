import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";
import { logSystemActivity } from "./activities";

// Get ALL matches across all briefs — used by the global Pipeline view
export const getAllMatches = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const matches = await ctx.db.query("matches").collect();

    const enriched = await Promise.all(
      matches.map(async (match) => {
        const [brief, property] = await Promise.all([
          ctx.db.get(match.briefId),
          ctx.db.get(match.propertyId),
        ]);
        return { ...match, brief, property };
      })
    );
    return enriched;
  },
});

// Get all matches for a specific property, joined with brief details
export const getMatchesForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_property", (q) => q.eq("propertyId", args.propertyId))
      .collect();

    const enriched = await Promise.all(
      matches.map(async (match) => {
        const brief = await ctx.db.get(match.briefId);
        return { ...match, brief };
      })
    );
    return enriched;
  },
});

// Get all matches for a specific brief, joined with the property details
export const getMatchesForBrief = query({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_brief", (q) => q.eq("briefId", args.briefId))
      .collect();

    // Join with property data
    const matchesWithProperties = await Promise.all(
      matches.map(async (match) => {
        const property = await ctx.db.get(match.propertyId);
        return {
          ...match,
          property,
        };
      })
    );

    return matchesWithProperties;
  },
});

// Create a new match between a brief and a property
export const createMatch = mutation({
  args: {
    briefId: v.id("briefs"),
    propertyId: v.id("properties"),
    status: v.string(), // "Shortlisted", "Under Review", etc.
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    
    // Check if match already exists to prevent duplicates
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_brief_and_property", (q) => 
        q.eq("briefId", args.briefId).eq("propertyId", args.propertyId)
      )
      .first();
      
    if (existing) {
      throw new Error("Property is already matched to this brief.");
    }

    return await ctx.db.insert("matches", {
      briefId: args.briefId,
      propertyId: args.propertyId,
      status: args.status as any,
      createdBy: identity.subject,
    });
  },
});

// Update match status or notes
export const updateMatch = mutation({
  args: {
    id: v.id("matches"),
    status: v.optional(v.union(
      v.literal("Shortlisted"),
      v.literal("Prepping"),
      v.literal("Report Ready"),
      v.literal("Under Review"),
      v.literal("Client Approved"),
      v.literal("Offer Submitted"),
      v.literal("Under Offer"),
      v.literal("Negotiating"),
      v.literal("Offer Accepted"),
      v.literal("Contract Execution"),
      v.literal("Due Diligence"),
      v.literal("Unconditional"),
      v.literal("Settlement"),
      v.literal("Client Rejected"),
      // Legacy — backward compat
      v.literal("Client Accepted"),
      v.literal("Rejected"),
      v.literal("Offered"),
      v.literal("Accepted"),
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    const { id, ...updates } = args;

    // Read existing state for diffing before patch
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Match not found");
    }

    await ctx.db.patch(id, updates);

    // Audit log: status transitions (e.g. "Shortlisted" → "Under Review")
    // are written to the activities feed for both the brief and the property,
    // so either record's Pulse Feed surfaces the change.
    if (updates.status && updates.status !== existing.status) {
      const property = await ctx.db.get(existing.propertyId);
      const propertyLabel = property?.address ?? "Property";
      const metadata = JSON.stringify({
        from: existing.status,
        to: updates.status,
        matchId: id,
      });

      await logSystemActivity(ctx, {
        recordId: existing.briefId,
        recordType: "brief",
        content: `Moved ${propertyLabel} from ${existing.status} to ${updates.status}`,
        metadata,
        userId: identity.subject,
      });

      await logSystemActivity(ctx, {
        recordId: existing.propertyId,
        recordType: "property",
        content: `Deal stage changed: ${existing.status} → ${updates.status}`,
        metadata,
        userId: identity.subject,
      });
    }
  },
});

// Remove a match entirely
export const deleteMatch = mutation({
  args: {
    id: v.id("matches"),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
