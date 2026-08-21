import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireStaffOrAdmin } from "./authz";

// ─── Maintenance (CLI-only via `npx convex run`) ─────────────────────────────

/**
 * Delete a batch of comps with source === "historical_import". Internal-only
 * (not exposed to the app). Returns how many were deleted so a CLI loop can
 * keep calling until 0. Used to refresh the bulk import without duplicating.
 */
export const purgeImportedComps = internalMutation({
  args: { batch: v.optional(v.number()), source: v.optional(v.string()) },
  handler: async (ctx, { batch, source }) => {
    const limit = batch ?? 2000;
    const src = source ?? "historical_import";
    const rows = await ctx.db
      .query("comps")
      .filter((q) => q.eq(q.field("source"), src))
      .take(limit);
    for (const r of rows) await ctx.db.delete(r._id);
    return { deleted: rows.length };
  },
});

// ─── Validators ────────────────────────────────────────────────────────────

const compTypeValidator = v.union(v.literal("lease"), v.literal("sale"));

const compWriteFields = {
  type: compTypeValidator,
  address: v.string(),
  suburb: v.string(),
  state: v.optional(v.string()),
  postcode: v.optional(v.string()),
  assetType: v.optional(v.string()),
  grade: v.optional(v.union(
    v.literal("Prime"),
    v.literal("A"),
    v.literal("B"),
    v.literal("C")
  )),
  nlaSqm: v.optional(v.number()),
  landAreaSqm: v.optional(v.number()),

  // Lease
  tenant: v.optional(v.string()),
  rentPa: v.optional(v.number()),
  rentInputFormat: v.optional(v.union(v.literal("annual"), v.literal("monthly"))),
  rentPerSqm: v.optional(v.number()),
  leaseType: v.optional(v.string()),
  leaseDate: v.optional(v.string()),
  leaseExpiry: v.optional(v.string()),
  leaseTerm: v.optional(v.string()),
  leaseTermYears: v.optional(v.number()),
  incentives: v.optional(v.string()),
  incentivePct: v.optional(v.number()),
  reviewType: v.optional(v.string()),
  reviewRate: v.optional(v.number()),

  // Sale
  salePrice: v.optional(v.number()),
  pricePerSqmBuild: v.optional(v.number()),
  pricePerSqmLand: v.optional(v.number()),
  capRate: v.optional(v.number()),
  saleDate: v.optional(v.string()),

  // Source
  source: v.optional(v.union(
    v.literal("agent_call"),
    v.literal("real_commercial"),
    v.literal("loopnet"),
    v.literal("im_scan"),
    v.literal("comp_scan"),
    v.literal("historical_import"),
    v.literal("arealytics"),
    v.literal("property_lions"),
    v.literal("other")
  )),
  verified: v.optional(v.boolean()),
  agentName: v.optional(v.string()),
  agentPhone: v.optional(v.string()),
  agentCompany: v.optional(v.string()),
  notes: v.optional(v.string()),

  // Links
  linkedPropertyId: v.optional(v.id("properties")),
  linkedExtractionId: v.optional(v.id("imExtractions")),
};

// ─── Queries ────────────────────────────────────────────────────────────────

/** All comps — paginated, optionally filtered by type. Max 500. */
export const getComps = query({
  args: {
    type: v.optional(compTypeValidator),
    suburb: v.optional(v.string()),
    assetType: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { type, suburb, assetType, source }) => {
    await requireStaffOrAdmin(ctx);

    // Use most specific index available
    if (suburb && assetType && type) {
      return ctx.db
        .query("comps")
        .withIndex("by_suburb_assetType_type", q =>
          q.eq("suburb", suburb).eq("assetType", assetType).eq("type", type)
        )
        .take(500);
    }
    if (suburb && type) {
      return ctx.db
        .query("comps")
        .withIndex("by_suburb_and_type", q =>
          q.eq("suburb", suburb).eq("type", type)
        )
        .take(500);
    }
    if (suburb) {
      return ctx.db
        .query("comps")
        .withIndex("by_suburb", q => q.eq("suburb", suburb))
        .take(500);
    }
    // Source-filtered browse (e.g. only curated team comps, or only Arealytics).
    // Indexed so it stays fast even with ~260k Arealytics rows in the table.
    if (source) {
      let q = ctx.db
        .query("comps")
        .withIndex("by_source", ix => ix.eq("source", source))
        .order("desc");
      const rows = await q.take(type ? 12000 : 6000);
      return type ? rows.filter(r => r.type === type) : rows;
    }
    // Browse-all branches: newest first so freshly-imported comps surface.
    // With the Arealytics archive loaded the table is large — the Comps page
    // defaults to a source filter; this unfiltered path is the "All sources" view.
    if (type) {
      return ctx.db
        .query("comps")
        .withIndex("by_type", q => q.eq("type", type))
        .order("desc")
        .take(6000);
    }

    return ctx.db.query("comps").order("desc").take(6000);
  },
});

/**
 * Paginated browse for the Comps page. Indexed by source/type and ordered
 * newest-first. Scales to the full ~260k table — the client loads 50 at a time.
 */
export const getCompsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(compTypeValidator),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, type, source }) => {
    await requireStaffOrAdmin(ctx);
    let q;
    if (source) {
      q = ctx.db.query("comps").withIndex("by_source", ix => ix.eq("source", source)).order("desc");
      if (type) q = q.filter(f => f.eq(f.field("type"), type));
    } else if (type) {
      q = ctx.db.query("comps").withIndex("by_type", ix => ix.eq("type", type)).order("desc");
    } else {
      q = ctx.db.query("comps").order("desc");
    }
    return await q.paginate(paginationOpts);
  },
});

/**
 * Paginated full-text search over comp addresses, filterable by type/source.
 * Used by the Comps page when the search box is non-empty.
 */
export const searchComps = query({
  args: {
    paginationOpts: paginationOptsValidator,
    query: v.string(),
    type: v.optional(compTypeValidator),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, query, type, source }) => {
    await requireStaffOrAdmin(ctx);
    const result = await ctx.db
      .query("comps")
      .withSearchIndex("search_address", s => {
        let b = s.search("address", query);
        if (type) b = b.eq("type", type);
        if (source) b = b.eq("source", source);
        return b;
      })
      .paginate(paginationOpts);
    return result;
  },
});

/** Comps linked to a specific property record. */
export const getCompsByProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireStaffOrAdmin(ctx);
    return ctx.db
      .query("comps")
      .withIndex("by_linkedProperty", q => q.eq("linkedPropertyId", propertyId))
      .take(100);
  },
});

/** Single comp by ID. */
export const getComp = query({
  args: { id: v.id("comps") },
  handler: async (ctx, { id }) => {
    await requireStaffOrAdmin(ctx);
    return ctx.db.get(id);
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Create a single comp. Accepts raw rent input and converts monthly → annual. */
export const createComp = mutation({
  args: compWriteFields,
  handler: async (ctx, args) => {
    await requireStaffOrAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Normalise rent: convert monthly to annual if needed
    let rentPa = args.rentPa;
    if (rentPa && args.rentInputFormat === "monthly") {
      rentPa = rentPa * 12;
    }

    // Auto-calculate derived fields
    const rentPerSqm =
      rentPa && args.nlaSqm && args.nlaSqm > 0
        ? Math.round((rentPa / args.nlaSqm) * 100) / 100
        : args.rentPerSqm;

    const pricePerSqmBuild =
      args.salePrice && args.nlaSqm && args.nlaSqm > 0
        ? Math.round((args.salePrice / args.nlaSqm) * 100) / 100
        : args.pricePerSqmBuild;
    const pricePerSqmLand =
      args.salePrice && args.landAreaSqm && args.landAreaSqm > 0
        ? Math.round((args.salePrice / args.landAreaSqm) * 100) / 100
        : args.pricePerSqmLand;

    return ctx.db.insert("comps", {
      ...args,
      rentPa,
      rentPerSqm,
      pricePerSqmBuild,
      pricePerSqmLand,
      createdBy: identity.subject,
    });
  },
});

/** Batch-insert comps (used when saving comps extracted from an IM scan). */
export const createComps = mutation({
  args: {
    comps: v.array(v.object(compWriteFields)),
  },
  handler: async (ctx, { comps }) => {
    await requireStaffOrAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const ids: string[] = [];
    for (const comp of comps) {
      let rentPa = comp.rentPa;
      if (rentPa && comp.rentInputFormat === "monthly") {
        rentPa = rentPa * 12;
      }
      const rentPerSqm =
        rentPa && comp.nlaSqm && comp.nlaSqm > 0
          ? Math.round((rentPa / comp.nlaSqm) * 100) / 100
          : comp.rentPerSqm;
      const pricePerSqmBuild =
        comp.salePrice && comp.nlaSqm && comp.nlaSqm > 0
          ? Math.round((comp.salePrice / comp.nlaSqm) * 100) / 100
          : comp.pricePerSqmBuild;
      const pricePerSqmLand =
        comp.salePrice && comp.landAreaSqm && comp.landAreaSqm > 0
          ? Math.round((comp.salePrice / comp.landAreaSqm) * 100) / 100
          : comp.pricePerSqmLand;

      const id = await ctx.db.insert("comps", {
        ...comp,
        rentPa,
        rentPerSqm,
        pricePerSqmBuild,
        pricePerSqmLand,
        createdBy: identity.subject,
      });
      ids.push(id);
    }
    return ids;
  },
});

/** Update an existing comp. */
export const updateComp = mutation({
  args: {
    id: v.id("comps"),
    ...Object.fromEntries(
      Object.entries(compWriteFields)
        .filter(([k]) => k !== "type") // type is immutable after creation
        .map(([k, v]) => [k, v])
    ) as Omit<typeof compWriteFields, "type">,
  },
  handler: async (ctx, { id, ...fields }) => {
    await requireStaffOrAdmin(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Re-derive calculated fields on update
    let rentPa = fields.rentPa;
    if (rentPa && fields.rentInputFormat === "monthly") {
      rentPa = rentPa * 12;
    }
    const rentPerSqm =
      rentPa && fields.nlaSqm && fields.nlaSqm > 0
        ? Math.round((rentPa / fields.nlaSqm) * 100) / 100
        : fields.rentPerSqm;
    const pricePerSqmBuild =
      fields.salePrice && fields.nlaSqm && fields.nlaSqm > 0
        ? Math.round((fields.salePrice / fields.nlaSqm) * 100) / 100
        : fields.pricePerSqmBuild;
    const pricePerSqmLand =
      fields.salePrice && fields.landAreaSqm && fields.landAreaSqm > 0
        ? Math.round((fields.salePrice / fields.landAreaSqm) * 100) / 100
        : fields.pricePerSqmLand;

    await ctx.db.patch(id, {
      ...fields,
      rentPa,
      rentPerSqm,
      pricePerSqmBuild,
      pricePerSqmLand,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    });
  },
});

/** Link (or unlink) a comp to an existing property — lightweight patch. */
export const linkCompToProperty = mutation({
  args: {
    id: v.id("comps"),
    linkedPropertyId: v.optional(v.id("properties")),
  },
  handler: async (ctx, { id, linkedPropertyId }) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.patch(id, { linkedPropertyId });
  },
});

/** Delete a comp. */
export const deleteComp = mutation({
  args: { id: v.id("comps") },
  handler: async (ctx, { id }) => {
    await requireStaffOrAdmin(ctx);
    await ctx.db.delete(id);
  },
});
