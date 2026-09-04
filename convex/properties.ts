import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logSystemActivity } from "./activities";
import { requireStaffOrAdmin } from "./authz";
import { waleFromTenants } from "./wale";
import { generateId } from "./utils";

const PROPERTY_STATUS = v.union(
  v.literal("On Market"),
  v.literal("Off Market"),
  v.literal("Under Offer"),
  v.literal("Sold"),
  v.literal("Archived"),
);

export const getProperties = query({
  args: {
    status: v.optional(PROPERTY_STATUS),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    let q = ctx.db.query("properties");
    if (args.status) {
      q = q.withIndex("by_status", (q) => q.eq("status", args.status!));
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
    suburb: v.optional(v.string()),
    assetType: v.string(),
    status: PROPERTY_STATUS,
    askingPrice: v.optional(v.number()),
    estimatedYield: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
    landArea: v.optional(v.number()),
    buildingArea: v.optional(v.number()),
    wales: v.optional(v.number()),
    photoIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);

    const propertyId = await generateId(ctx, "P");

    const newId = await ctx.db.insert("properties", {
      ...args,
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

/** Set a property's photos (used to backfill photos pulled from its IM). */
export const setPropertyPhotos = mutation({
  args: { id: v.id("properties"), photoIds: v.array(v.string()) },
  handler: async (ctx, { id, photoIds }) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.patch(id, { photoIds });
  },
});

const videoObject = v.object({
  id: v.string(),
  kind: v.union(v.literal("link"), v.literal("upload")),
  url: v.optional(v.string()),
  storageId: v.optional(v.string()),
  title: v.optional(v.string()),
  addedAt: v.number(),
});

/** Replace a property's video list (add/remove computed client-side). */
export const setPropertyVideos = mutation({
  args: { id: v.id("properties"), videos: v.array(videoObject) },
  handler: async (ctx, { id, videos }) => {
    await requireStaffOrAdmin(ctx);
    if (videos.length > 50) throw new Error("A property cannot have more than 50 videos.");
    await ctx.db.patch(id, { videos });
  },
});

const tenantObject = v.object({
  id: v.string(),
  tenantName: v.string(),
  suite: v.optional(v.string()),
  lettableArea: v.optional(v.number()),
  leaseStart: v.optional(v.string()),
  leaseEnd: v.optional(v.string()),
  netFaceRent: v.optional(v.number()),
  leaseType: v.optional(v.string()),
  reviewType: v.optional(v.string()),
  reviewRate: v.optional(v.number()),
  nextReviewDate: v.optional(v.string()),
  options: v.optional(v.string()),
});

const outgoingObject = v.object({
  id: v.string(),
  category: v.string(),
  amount: v.number(),
  notes: v.optional(v.string()),
});

export const updatePropertyTenants = mutation({
  args: {
    id: v.id("properties"),
    tenants: v.array(tenantObject),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const { id, tenants } = args;
    if (tenants.length > 100) {
      throw new Error("A property cannot have more than 100 tenants.");
    }

    // WALE is derived from the tenancy schedule, so it has to be recomputed
    // here. It used to be calculated once at IM-scan time and stored, which
    // meant editing a lease expiry left the headline figure showing a stale
    // number with no indication anything was out of date.
    //
    // Only overwrite when the schedule can actually produce a figure. A null
    // means "not computable from this data" — a property whose WALE was
    // entered by hand, or scanned from an IM with no schedule, keeps it.
    const wales = waleFromTenants(tenants);
    await ctx.db.patch(id, wales === null ? { tenants } : { tenants, wales });
  },
});

export const updatePropertyOutgoings = mutation({
  args: {
    id: v.id("properties"),
    outgoings: v.array(outgoingObject),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const { id, outgoings } = args;
    if (outgoings.length > 100) {
      throw new Error("A property cannot have more than 100 outgoing line items.");
    }
    await ctx.db.patch(id, { outgoings });
  },
});

export const updateProperty = mutation({
  args: {
    id: v.id("properties"),
    address: v.optional(v.string()),
    assetType: v.optional(v.string()),
    status: v.optional(PROPERTY_STATUS),
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

/** Persist the generated FEASO Google Sheet reference on a property. Internal —
 *  called by convex/googleSheets.ts after creating the sheet. */
export const setFeasoSheet = internalMutation({
  args: { id: v.id("properties"), url: v.string(), sheetId: v.string() },
  handler: async (ctx, { id, url, sheetId }) => {
    await ctx.db.patch(id, { feasoSheetUrl: url, feasoSheetId: sheetId, feasoSheetAt: Date.now() });
  },
});
