import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// Directory contacts: agents, contractors/inspectors, solicitors, brokers.
// Clients are NOT stored here — the Directory page aggregates them from the
// `clients` table. See src/pages/Directory.jsx.

const CATEGORY = v.union(
  v.literal("agent"),
  v.literal("contractor"),
  v.literal("solicitor"),
  v.literal("broker"),
  v.literal("other")
);

/**
 * List contacts, optionally narrowed by category and/or state, or searched by
 * name. Indexed + capped per CLAUDE.md §2. Staff/admin only.
 */
export const listContacts = query({
  args: {
    category: v.optional(CATEGORY),
    state: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, { category, state, search }) => {
    await requireStaffOrAdmin(ctx);
    const term = (search || "").trim();

    if (term) {
      // Search index handles category/state as exact filter fields.
      return await ctx.db
        .query("contacts")
        .withSearchIndex("search_name", (q) => {
          let s = q.search("name", term);
          if (category) s = s.eq("category", category);
          if (state) s = s.eq("state", state);
          return s;
        })
        .take(200);
    }

    if (category) {
      const rows = await ctx.db
        .query("contacts")
        .withIndex("by_category", (q) => q.eq("category", category))
        .take(500);
      return state ? rows.filter((r) => r.state === state) : rows;
    }

    // All categories — ordered by name via index, bounded. State filtered in-memory.
    const rows = await ctx.db.query("contacts").withIndex("by_name").take(500);
    return state ? rows.filter((r) => r.state === state) : rows;
  },
});

export const createContact = mutation({
  args: {
    name: v.string(),
    category: CATEGORY,
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    state: v.optional(v.string()),
    suburb: v.optional(v.string()),
    specialty: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    return await ctx.db.insert("contacts", {
      ...args,
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });
  },
});

export const updateContact = mutation({
  args: {
    id: v.id("contacts"),
    name: v.optional(v.string()),
    category: v.optional(CATEGORY),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    state: v.optional(v.string()),
    suburb: v.optional(v.string()),
    specialty: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

export const deleteContact = mutation({
  args: { id: v.id("contacts") },
  handler: async (ctx, { id }) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.delete(id);
  },
});
