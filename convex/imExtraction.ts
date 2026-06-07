import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// ─── Upload ───────────────────────────────────────────────────────────────────

/** Get a short-lived URL to upload a PDF directly from the browser to Convex storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Create a pending extraction record immediately after upload, before Claude runs. */
export const createPendingExtraction = mutation({
  args: {
    storageId: v.string(),
    filename: v.string(),
    propertyId: v.optional(v.id("properties")),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    return await ctx.db.insert("imExtractions", {
      ...args,
      status: "processing",
      createdBy: identity.subject,
    });
  },
});

// ─── Internal status updates (called from the action only) ────────────────────

export const markComplete = internalMutation({
  args: {
    id: v.id("imExtractions"),
    result: v.string(),
    model: v.string(),
    latencyMs: v.number(),
  },
  handler: async (ctx, { id, result, model, latencyMs }) => {
    await ctx.db.patch(id, { status: "complete", result, model, latencyMs });
  },
});

export const markFailed = internalMutation({
  args: {
    id: v.id("imExtractions"),
    error: v.string(),
  },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, { status: "failed", error });
  },
});

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getExtraction = query({
  args: { id: v.id("imExtractions") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const getExtractions = query({
  args: { propertyId: v.optional(v.id("properties")) },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    if (args.propertyId) {
      return await ctx.db
        .query("imExtractions")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId))
        .order("desc")
        .take(20);
    }
    return await ctx.db.query("imExtractions").order("desc").take(50);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Persist user edits to the extraction result. */
export const saveEdits = mutation({
  args: {
    id: v.id("imExtractions"),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.patch(args.id, { result: args.result });
  },
});

/** Link an extraction to an existing property record. */
export const linkToProperty = mutation({
  args: {
    id: v.id("imExtractions"),
    propertyId: v.id("properties"),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.patch(args.id, { propertyId: args.propertyId });
  },
});

/** Delete an extraction and its source file from storage. */
export const deleteExtraction = mutation({
  args: { id: v.id("imExtractions") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const ex = await ctx.db.get(args.id);
    if (!ex) return;
    await ctx.db.delete(args.id);
    if (ex.storageId) {
      try {
        await ctx.storage.delete(ex.storageId as any);
      } catch {
        // Ignore if already cleaned up
      }
    }
  },
});
