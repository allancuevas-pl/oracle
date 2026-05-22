import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

export const getClients = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.db.query("clients").order("asc").collect();
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
