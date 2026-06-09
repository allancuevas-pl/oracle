import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin } from "./authz";

// ─── Validators ────────────────────────────────────────────────────────────

const compTypeValidator = v.union(v.literal("lease"), v.literal("sale"));

const compWriteFields = {
  type: compTypeValidator,
  address: v.string(),
  suburb: v.string(),
  state: v.optional(v.string()),
  assetType: v.optional(v.string()),
  nlaSqm: v.optional(v.number()),
  landAreaSqm: v.optional(v.number()),

  // Lease
  rentPa: v.optional(v.number()),
  rentInputFormat: v.optional(v.union(v.literal("annual"), v.literal("monthly"))),
  rentPerSqm: v.optional(v.number()),
  leaseType: v.optional(v.string()),
  leaseDate: v.optional(v.string()),
  leaseTerm: v.optional(v.string()),
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
  },
  handler: async (ctx, { type, suburb, assetType }) => {
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
    if (type) {
      return ctx.db
        .query("comps")
        .withIndex("by_type", q => q.eq("type", type))
        .take(500);
    }

    return ctx.db.query("comps").take(500);
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

    return ctx.db.insert("comps", {
      ...args,
      rentPa,
      rentPerSqm,
      pricePerSqmBuild,
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

      const id = await ctx.db.insert("comps", {
        ...comp,
        rentPa,
        rentPerSqm,
        pricePerSqmBuild,
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

    await ctx.db.patch(id, { ...fields, rentPa, rentPerSqm, pricePerSqmBuild });
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
