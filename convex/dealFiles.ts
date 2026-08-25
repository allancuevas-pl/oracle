import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// Deal vault — sensitive deal documents on a property.
//   - Staff/admin: upload, list, retag visibility/category, delete (all here).
//   - `visibility` "internal" = staff-only; "client" = also shareable to the
//     client portal (portal surfacing is a follow-up). Client-facing reads,
//     when built, will live in clientPortal.ts with the other client queries.

const FILE_LIMIT = 200; // per property; documented cap (CLAUDE.md §2.2)
const VISIBILITY = v.union(v.literal("internal"), v.literal("client"));

/** Short-lived URL to upload a file directly from the browser to storage. Staff only. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Record a deal file after the browser has uploaded it. Staff only. */
export const addFile = mutation({
  args: {
    propertyId: v.id("properties"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    visibility: VISIBILITY,
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    const property = await ctx.db.get(args.propertyId);
    if (!property) {
      await ctx.storage.delete(args.storageId); // don't orphan the upload
      throw new Error("Property not found");
    }
    return await ctx.db.insert("dealFiles", {
      ...args,
      uploadedBy: identity.subject,
      uploadedAt: Date.now(),
    });
  },
});

/** Retag a deal file's visibility and/or category. Staff only. */
export const updateFile = mutation({
  args: {
    id: v.id("dealFiles"),
    visibility: v.optional(VISIBILITY),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.patch(id, updates);
  },
});

/** Delete a deal file and its underlying storage file. Staff only. */
export const deleteFile = mutation({
  args: { id: v.id("dealFiles") },
  handler: async (ctx, { id }) => {
    await requireStaffOrAdmin(ctx);
    const file = await ctx.db.get(id);
    if (!file) return;
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(id);
  },
});

/** All deal files for a property, with signed download URLs. Staff only. */
export const listForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireStaffOrAdmin(ctx);
    const files = await ctx.db
      .query("dealFiles")
      .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
      .take(FILE_LIMIT);
    const withUrl = await Promise.all(
      files.map(async (f) => ({
        _id: f._id,
        fileName: f.fileName,
        contentType: f.contentType,
        size: f.size,
        visibility: f.visibility,
        category: f.category,
        uploadedAt: f.uploadedAt,
        url: await ctx.storage.getUrl(f.storageId),
      }))
    );
    return withUrl.filter((f) => f.url).sort((a, b) => b.uploadedAt - a.uploadedAt);
  },
});
