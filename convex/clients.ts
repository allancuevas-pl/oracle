import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

export const getClients = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    // 500 is a generous cap for a CRE firm's client roster.
    // If this ceiling is ever approached, move to cursor-based pagination
    // and a server-side search index on the client picker.
    return await ctx.db.query("clients").order("asc").take(500);
  },
});

// Lightweight projection for pickers — returns only the fields needed to
// populate a dropdown. Avoids sending phone, email, notes, etc. over the wire.
export const getClientSummaries = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const clients = await ctx.db.query("clients").order("asc").take(500);
    return clients.map((c) => ({ _id: c._id, name: c.name, company: c.company }));
  },
});

export const getClient = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

export const createClient = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    company: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("buyer"),
      v.literal("seller"),
      v.literal("vendor"),
      v.literal("other")
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    return await ctx.db.insert("clients", {
      ...args,
      createdBy: identity.subject,
    });
  },
});

export const updateClient = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    company: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("buyer"),
      v.literal("seller"),
      v.literal("vendor"),
      v.literal("other")
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteClient = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});
