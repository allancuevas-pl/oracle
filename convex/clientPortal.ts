import { query } from "./_generated/server";
import { v } from "convex/values";
import { shapeDocsWithUrls, CLIENT_DOC_LIMIT } from "./clientDocuments";

/**
 * Returns all deal data visible to the currently logged-in client.
 * Requires: role === "client" in the users table.
 *
 * Flow: Clerk identity.email → clients record → briefs → dealReports + properties.
 */
export const getMyPortalData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Confirm this is a client-role user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", q => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "client") return null;

    // Look up their clients record by email
    const email = (identity.email || "").toLowerCase();
    const clientRecord = email
      ? await ctx.db
          .query("clients")
          .withIndex("by_email", q => q.eq("email", email))
          .first()
      : null;

    // Get briefs linked to this client
    const briefs = clientRecord
      ? await ctx.db
          .query("briefs")
          .withIndex("by_clientId", q => q.eq("clientId", clientRecord._id))
          .take(100)
      : [];

    // Collect all deal reports for those briefs
    const reportBatches = await Promise.all(
      briefs.map(b =>
        ctx.db
          .query("dealReports")
          .withIndex("by_briefId", q => q.eq("briefId", b._id))
          .take(20)
      )
    );
    const reports = reportBatches.flat();

    // Fetch properties for each report (deduplicated)
    const propertyIds = [...new Set(reports.map(r => r.propertyId.toString()))];
    const properties = await Promise.all(
      reports
        .filter((r, i, arr) => arr.findIndex(x => x.propertyId === r.propertyId) === i)
        .map(r => ctx.db.get(r.propertyId))
    );
    const propertyMap = Object.fromEntries(
      properties.filter(Boolean).map(p => [p!._id.toString(), p])
    );

    return {
      user,
      clientRecord,
      reports: reports.map(r => ({
        ...r,
        property: propertyMap[r.propertyId.toString()] ?? null,
      })),
    };
  },
});

/**
 * Fetch a single deal report for the client portal detail view.
 * Validates the logged-in client actually has access to this report.
 */
export const getMyReport = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", q => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "client") return null;

    // Fetch report by token
    const report = await ctx.db
      .query("dealReports")
      .withIndex("by_token", q => q.eq("token", token))
      .first();
    if (!report) return null;

    // Verify access: the brief must belong to a client with this email
    const brief = await ctx.db.get(report.briefId);
    if (brief?.clientId) {
      const clientRecord = await ctx.db.get(brief.clientId);
      const email = (identity.email || "").toLowerCase();
      if (clientRecord?.email?.toLowerCase() !== email) return null;
    }

    const [property, feaso] = await Promise.all([
      ctx.db.get(report.propertyId),
      ctx.db
        .query("feasos")
        .withIndex("by_propertyId", q => q.eq("propertyId", report.propertyId))
        .first(),
    ]);

    const comps = await ctx.db
      .query("comps")
      .withIndex("by_linkedProperty", q => q.eq("linkedPropertyId", report.propertyId))
      .take(30);

    // Resolve video sources: hosted links pass through; uploads → served URLs.
    const videos = await Promise.all(
      (property?.videos ?? []).map(async (vid) => ({
        id: vid.id,
        kind: vid.kind,
        title: vid.title,
        url: vid.kind === "upload" && vid.storageId
          ? await ctx.storage.getUrl(vid.storageId)
          : vid.url,
      }))
    );

    return { report, property, feaso, comps, brief, videos: videos.filter(v => v.url) };
  },
});

/**
 * Client-portal query: the logged-in client's own AML / compliance documents.
 * Security: requires role === "client"; resolves the caller's email to a
 * clients record and returns ONLY that client's docs (with signed URLs). The
 * clientId is derived server-side from identity — never accepted from the caller.
 */
export const getMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", q => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.role !== "client") return [];

    const email = (identity.email || "").toLowerCase();
    if (!email) return [];

    const clientRecord = await ctx.db
      .query("clients")
      .withIndex("by_email", q => q.eq("email", email))
      .first();
    if (!clientRecord) return [];

    const docs = await ctx.db
      .query("clientDocuments")
      .withIndex("by_clientId", q => q.eq("clientId", clientRecord._id))
      .take(CLIENT_DOC_LIMIT);
    return await shapeDocsWithUrls(ctx, docs);
  },
});
