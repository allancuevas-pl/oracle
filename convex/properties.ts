import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { logSystemActivity } from "./activities";
import { requireStaffOrAdmin } from "./authz";
import { generateId } from "./utils";

export const getProperties = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    let q = ctx.db.query("properties");
    if (args.status) {
      q = q.withIndex("by_status", (q) => q.eq("status", args.status as any));
    }
    return await q.order("desc").take(100);
  },
});

export const getProperty = query({
  args: { id: v.id("properties") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const createProperty = mutation({
  args: {
    address: v.string(),
    assetType: v.string(),
    status: v.string(),
    askingPrice: v.optional(v.number()),
    estimatedYield: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    landArea: v.optional(v.number()),
    buildingArea: v.optional(v.number()),
    wales: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    
    const propertyId = await generateId(ctx, "P");
    
    const newId = await ctx.db.insert("properties", {
      ...args,
      status: args.status as any,
      propertyId,
      createdBy: identity.subject,
    });

    await logSystemActivity(ctx, {
      recordId: newId,
      recordType: "property",
      content: `Property added`,
      userId: identity.subject,
    });

    return newId;
  },
});

export const updateProperty = mutation({
  args: {
    id: v.id("properties"),
    address: v.optional(v.string()),
    assetType: v.optional(v.string()),
    status: v.optional(v.string()),
    askingPrice: v.optional(v.number()),
    estimatedYield: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    landArea: v.optional(v.number()),
    buildingArea: v.optional(v.number()),
    wales: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    const { id, ...updates } = args;
    
    const oldProp = await ctx.db.get(id);
    if (!oldProp) throw new Error("Property not found");

    await ctx.db.patch(id, updates);

    if (updates.status && updates.status !== oldProp.status) {
      await logSystemActivity(ctx, {
        recordId: id,
        recordType: "property",
        content: `Status changed to ${updates.status}`,
        userId: identity.subject,
      });
    }
  },
});
