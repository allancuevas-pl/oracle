import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// AML / compliance documents for a client.
//   - Staff/admin: upload, list, delete (all mutations role-checked, here).
//   - Client portal: the client-facing read lives in `clientPortal.ts`
//     (`getMyDocuments`) so it sits with the other client-role queries the
//     authz gate allowlists. It reuses `shapeDocsWithUrls` exported below.
// Clients are view/download-only; there is no client-facing mutation here.

const DOC_LIMIT = 200; // per client; documented cap (CLAUDE.md §2.2)

/** Short-lived URL to upload a file directly from the browser to Convex storage. Staff only. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Record a document after the browser has uploaded the file. Staff only. */
export const addDocument = mutation({
  args: {
    clientId: v.id("clients"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    // Guard against orphaning the just-uploaded file if the client id is bad.
    const client = await ctx.db.get(args.clientId);
    if (!client) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Client not found");
    }
    return await ctx.db.insert("clientDocuments", {
      clientId: args.clientId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      label: args.label,
      uploadedBy: identity.subject,
      uploadedAt: Date.now(),
    });
  },
});

/** Delete a document record and its underlying storage file. Staff only. */
export const deleteDocument = mutation({
  args: { id: v.id("clientDocuments") },
  handler: async (ctx, { id }) => {
    await requireStaffOrAdmin(ctx);
    const doc = await ctx.db.get(id);
    if (!doc) return;
    // Unlike photos/videos, an AML doc's file is not shared with any other
    // record, so it is safe to reclaim the storage file on delete.
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(id);
  },
});

/** All documents for a client, with signed download URLs. Staff only. */
export const listForClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, { clientId }) => {
    await requireStaffOrAdmin(ctx);
    const docs = await ctx.db
      .query("clientDocuments")
      .withIndex("by_clientId", (q) => q.eq("clientId", clientId))
      .take(DOC_LIMIT);
    return await shapeDocsWithUrls(ctx, docs);
  },
});

// The per-client cap, shared with the client-portal read in clientPortal.ts.
export const CLIENT_DOC_LIMIT = DOC_LIMIT;

// Attach a signed download URL to each document; drop any whose file is gone.
// Exported so the client-portal read (clientPortal.getMyDocuments) reuses it.
export async function shapeDocsWithUrls(ctx, docs) {
  const withUrl = await Promise.all(
    docs.map(async (d) => ({
      _id: d._id,
      fileName: d.fileName,
      contentType: d.contentType,
      size: d.size,
      label: d.label,
      uploadedAt: d.uploadedAt,
      url: await ctx.storage.getUrl(d.storageId),
    }))
  );
  return withUrl
    .filter((d) => d.url)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}
