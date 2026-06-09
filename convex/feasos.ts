import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// Shared field validators for feaso inputs
const feasoFields = {
  marketRentLow: v.optional(v.number()),
  marketRentHigh: v.optional(v.number()),
  salePricePerSqmBuildLow: v.optional(v.number()),
  salePricePerSqmBuildHigh: v.optional(v.number()),
  salePricePerSqmLandLow: v.optional(v.number()),
  salePricePerSqmLandHigh: v.optional(v.number()),
  adoptedCapRate: v.optional(v.number()),
  offerPrice: v.optional(v.number()),
  projectDurationYears: v.optional(v.number()),
  stampDutyPct: v.optional(v.number()),
  closingCosts: v.optional(v.number()),
  baFeePct: v.optional(v.number()),
  leasingCostsPct: v.optional(v.number()),
  incentivesPct: v.optional(v.number()),
  incentiveTermYears: v.optional(v.number()),
  interestRatePct: v.optional(v.number()),
  ltvRatio: v.optional(v.number()),
  works: v.optional(v.number()),
  vacancyMonths: v.optional(v.number()),
  notes: v.optional(v.string()),
};

/** Fetch the feaso record for a property (returns null if none exists yet). */
export const getFeasoForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireStaffOrAdmin(ctx);
    return ctx.db
      .query("feasos")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", propertyId))
      .first();
  },
});

/**
 * Upsert a feaso record for a property.
 * Creates on first call, patches on subsequent calls.
 * Only the fields provided in `updates` are written — existing fields are preserved.
 */
export const upsertFeaso = mutation({
  args: {
    propertyId: v.id("properties"),
    ...feasoFields,
  },
  handler: async (ctx, { propertyId, ...updates }) => {
    const { identity } = await requireStaffOrAdmin(ctx);

    const existing = await ctx.db
      .query("feasos")
      .withIndex("by_propertyId", (q) => q.eq("propertyId", propertyId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("feasos", {
        propertyId,
        ...updates,
        createdBy: identity.subject,
      });
    }
  },
});
