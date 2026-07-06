import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// ── Staff queries ─────────────────────────────────────────────────────────────

/** All reports sent for a given property. Staff/admin only. */
export const getReportsByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireStaffOrAdmin(ctx);
    return ctx.db
      .query("dealReports")
      .withIndex("by_propertyId", q => q.eq("propertyId", propertyId))
      .take(50);
  },
});

/** All reports for a brief. Staff/admin only. */
export const getReportsByBrief = query({
  args: { briefId: v.id("briefs") },
  handler: async (ctx, { briefId }) => {
    await requireStaffOrAdmin(ctx);
    return ctx.db
      .query("dealReports")
      .withIndex("by_briefId", q => q.eq("briefId", briefId))
      .take(50);
  },
});

// ── Public query — token IS the credential ────────────────────────────────────

/**
 * Fetch the full report bundle for the client portal.
 * No auth required — the UUID token is the credential.
 * Called by /report/:token with no Clerk session.
 */
export const getReportByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const report = await ctx.db
      .query("dealReports")
      .withIndex("by_token", q => q.eq("token", token))
      .first();

    if (!report) return null;

    const [property, brief] = await Promise.all([
      ctx.db.get(report.propertyId),
      ctx.db.get(report.briefId),
    ]);

    const feaso = property
      ? await ctx.db
          .query("feasos")
          .withIndex("by_propertyId", q => q.eq("propertyId", report.propertyId))
          .first()
      : null;

    const comps = await ctx.db
      .query("comps")
      .withIndex("by_linkedProperty", q => q.eq("linkedPropertyId", report.propertyId))
      .take(30);

    return { report, property, feaso, comps, brief };
  },
});

// ── Staff mutations ───────────────────────────────────────────────────────────

/** Create + send a new deal report. Token generated client-side (crypto.randomUUID). */
export const createDealReport = mutation({
  args: {
    briefId: v.id("briefs"),
    propertyId: v.id("properties"),
    matchId: v.optional(v.id("matches")),
    clientName: v.string(),
    clientEmail: v.optional(v.string()),
    propertyAddress: v.string(),
    token: v.string(),
    analystMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Guard against (astronomically unlikely) token collision
    const existing = await ctx.db
      .query("dealReports")
      .withIndex("by_token", q => q.eq("token", args.token))
      .first();
    if (existing) throw new Error("Token collision — please retry");

    return ctx.db.insert("dealReports", {
      ...args,
      status: "sent",
      sentAt: Date.now(),
      createdBy: identity.subject,
    });
  },
});

/** Update analyst message or client email before resending. Staff/admin only. */
export const updateDealReport = mutation({
  args: {
    id: v.id("dealReports"),
    analystMessage: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.patch(id, fields);
  },
});

// ── Public mutations — token IS the credential ────────────────────────────────

/** Mark report as viewed when client opens the link for the first time. */
export const markReportViewed = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const report = await ctx.db
      .query("dealReports")
      .withIndex("by_token", q => q.eq("token", token))
      .first();
    if (!report || report.status !== "sent") return;
    await ctx.db.patch(report._id, { status: "viewed", viewedAt: Date.now() });
  },
});

/** Client submits their approve / decline decision. */
export const submitClientDecision = mutation({
  args: {
    token: v.string(),
    decision: v.union(v.literal("approved"), v.literal("declined")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { token, decision, note }) => {
    const report = await ctx.db
      .query("dealReports")
      .withIndex("by_token", q => q.eq("token", token))
      .first();
    if (!report) throw new Error("Report not found");
    if (report.clientDecision) throw new Error("Decision already submitted");

    await ctx.db.patch(report._id, {
      status: decision,
      clientDecision: decision,
      clientNote: note,
      respondedAt: Date.now(),
    });
  },
});
