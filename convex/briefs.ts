import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { logSystemActivity } from "./activities";
import { requireStaffOrAdmin } from "./authz";
import { generateId } from "./utils";

export const getBriefs = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx); 
    const targetStatus = args.status ?? "active";
    return await ctx.db
      .query("briefs")
      .withIndex("by_status", (q) => q.eq("status", targetStatus))
      .order("desc")
      .take(50); 
  },
});

export const getBrief = query({
  args: {
    id: v.id("briefs"),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const brief = await ctx.db.get(args.id);
    if (!brief) return null;
    const client = brief.clientId ? await ctx.db.get(brief.clientId) : null;

    // Enrich assignees with user records for display
    const enrichedAssignees = brief.assignees
      ? await Promise.all(
          brief.assignees.map(async (a) => {
            const user = await ctx.db.get(a.userId);
            return { ...a, user };
          })
        )
      : [];

    return { ...brief, client, enrichedAssignees };
  },
});

export const getBriefsByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    return await ctx.db
      .query("briefs")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .collect();
  },
});

export const createBrief = mutation({
  args: {
    clientId: v.optional(v.id("clients")),
    clientName: v.string(),
    stage: v.string(),
    priority: v.optional(v.string()),
    capital: v.optional(v.number()),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    durationMin: v.optional(v.number()),
    durationMax: v.optional(v.number()),
    debtStructure: v.optional(v.array(v.string())),
    location: v.optional(v.array(v.string())),
    assetTypes: v.optional(v.array(v.string())),
    strategies: v.optional(v.array(v.string())),
    targets: v.optional(v.string()),
    others: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);

    // Generate sequential briefId (e.g. ORC-B0001)
    const briefId = await generateId(ctx, "B");

    const newId = await ctx.db.insert("briefs", {
      briefId,
      clientId: args.clientId,
      clientName: args.clientName,
      startDate: Date.now(),
      stage: args.stage,
      priority: args.priority,
      capital: args.capital,
      budgetMin: args.budgetMin,
      budgetMax: args.budgetMax,
      durationMin: args.durationMin,
      durationMax: args.durationMax,
      debtStructure: args.debtStructure,
      location: args.location,
      assetTypes: args.assetTypes,
      strategies: args.strategies,
      targets: args.targets,
      others: args.others,
      status: "active",
      createdBy: identity.subject,
    });

    await logSystemActivity(ctx, {
      recordId: newId,
      recordType: "brief",
      content: `Brief created`,
      userId: identity.subject,
    });

    return newId;
  },
});

export const updateBrief = mutation({
  args: {
    id: v.id("briefs"),
    clientId: v.optional(v.id("clients")),
    clientName: v.optional(v.string()),
    stage: v.optional(v.string()),
    priority: v.optional(v.string()),
    capital: v.optional(v.number()),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    durationMin: v.optional(v.number()),
    durationMax: v.optional(v.number()),
    debtStructure: v.optional(v.array(v.string())),
    location: v.optional(v.array(v.string())),
    assetTypes: v.optional(v.array(v.string())),
    strategies: v.optional(v.array(v.string())),
    targets: v.optional(v.string()),
    others: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    const { id, ...updates } = args;
    
    const oldBrief = await ctx.db.get(id);
    if (!oldBrief) throw new Error("Brief not found");

    await ctx.db.patch(id, updates);

    if (updates.stage && updates.stage !== oldBrief.stage) {
      await logSystemActivity(ctx, {
        recordId: id,
        recordType: "brief",
        content: `Stage changed to ${updates.stage}`,
        userId: identity.subject,
      });
    }
    
    if (updates.priority && updates.priority !== oldBrief.priority) {
      await logSystemActivity(ctx, {
        recordId: id,
        recordType: "brief",
        content: `Priority changed to ${updates.priority}`,
        userId: identity.subject,
      });
    }
  },
});

export const updateAssignees = mutation({
  args: {
    id: v.id("briefs"),
    assignees: v.array(v.object({
      userId: v.id("users"),
      role: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireStaffOrAdmin(ctx);
    await ctx.db.patch(args.id, { assignees: args.assignees });
    await logSystemActivity(ctx, {
      recordId: args.id,
      recordType: "brief",
      content: `Team updated (${args.assignees.length} member${args.assignees.length !== 1 ? 's' : ''} assigned)`,
      userId: identity.subject,
    });
  },
});
