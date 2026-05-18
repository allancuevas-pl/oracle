import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function requireStaff(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated call");
  }
  return identity;
}

export const getProperties = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
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
    await requireStaff(ctx);
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
    const identity = await requireStaff(ctx);
    
    const existingProps = await ctx.db.query("properties").collect();
    const nextNum = existingProps.length + 1;
    const propertyId = `ORC-P${nextNum.toString().padStart(4, '0')}`;
    
    return await ctx.db.insert("properties", {
      ...args,
      status: args.status as any,
      propertyId,
      createdBy: identity.subject,
    });
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
    await requireStaff(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});
