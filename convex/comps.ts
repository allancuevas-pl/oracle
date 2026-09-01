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

/**
 * Keyword blob backing the comps search box.
 *
 * A Convex search index takes exactly one searchField, and ours indexed
 * `address` alone — so typing a suburb returned nothing at all, even though
 * suburb is the more natural way to look for comps (Will, Loom 27 Aug:
 * "you can't search by suburb, you have to search by address... that search
 * bar should be just whatever keyword goes in"). Concatenating the location
 * fields into one indexed string makes all of them searchable at once.
 */
export function compSearchText(c: {
  address?: string; suburb?: string; state?: string; postcode?: string;
}): string {
  return [c.address, c.suburb, c.state, c.postcode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ─── Secondary filters (server-side) ────────────────────────────────────────

/**
 * Optional "secondary" filters for the Comps browse/search screens: state,
 * asset type, recency, and size bands.
 *
 * These MUST be applied server-side. They used to run in the browser over
 * whatever pages had been loaded, which is invisible at ~100 comps but silently
 * wrong at ~260k — filtering State=VIC would only ever search the first page or
 * two and report a handful of matches out of tens of thousands. Convex applies
 * `.filter()` before `.paginate()`, so a page of 50 is 50 *matching* rows.
 */
const compFilterArgs = {
  state: v.optional(v.string()),
  assetTypes: v.optional(v.array(v.string())),
  dateFrom: v.optional(v.string()),   // ISO "YYYY-MM-DD"; comp must be on/after
  nlaMin: v.optional(v.number()),
  nlaMax: v.optional(v.number()),
  landMin: v.optional(v.number()),
  landMax: v.optional(v.number()),
};

type CompFilters = {
  state?: string;
  assetTypes?: string[];
  dateFrom?: string;
  nlaMin?: number;
  nlaMax?: number;
  landMin?: number;
  landMax?: number;
};

/** True when no secondary filter is set — lets the caller skip `.filter()`. */
function hasCompFilters(f: CompFilters): boolean {
  return !!(
    f.state ||
    (f.assetTypes && f.assetTypes.length > 0) ||
    f.dateFrom ||
    f.nlaMin != null || f.nlaMax != null ||
    f.landMin != null || f.landMax != null
  );
}

/**
 * Build the Convex filter predicate for the secondary filters. Mirrors exactly
 * what the Comps page used to do client-side, including the "missing value is
 * excluded" behaviour — an undefined field fails `gte`, so size/date filters
 * drop comps that lack the field, as before.
 */
function compFilterPredicate(q: any, f: CompFilters) {
  const preds: any[] = [];

  if (f.state) preds.push(q.eq(q.field("state"), f.state));

  if (f.assetTypes && f.assetTypes.length > 0) {
    const eqs = f.assetTypes.map((a) => q.eq(q.field("assetType"), a));
    preds.push(eqs.length === 1 ? eqs[0] : q.or(...eqs));
  }

  // Date is type-dependent: leases use leaseDate, sales use saleDate.
  if (f.dateFrom) {
    preds.push(
      q.or(
        q.and(q.eq(q.field("type"), "lease"), q.gte(q.field("leaseDate"), f.dateFrom)),
        q.and(q.eq(q.field("type"), "sale"),  q.gte(q.field("saleDate"),  f.dateFrom)),
      )
    );
  }

  if (f.nlaMin != null || f.nlaMax != null) {
    preds.push(q.gt(q.field("nlaSqm"), 0));
    if (f.nlaMin != null) preds.push(q.gte(q.field("nlaSqm"), f.nlaMin));
    if (f.nlaMax != null) preds.push(q.lte(q.field("nlaSqm"), f.nlaMax));
  }

  if (f.landMin != null || f.landMax != null) {
    preds.push(q.gt(q.field("landAreaSqm"), 0));
    if (f.landMin != null) preds.push(q.gte(q.field("landAreaSqm"), f.landMin));
    if (f.landMax != null) preds.push(q.lte(q.field("landAreaSqm"), f.landMax));
  }

  return preds.length === 1 ? preds[0] : q.and(...preds);
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Comps near a property — matched by suburb, narrowed by asset type / comp type.
 *
 * `suburb` is required: this is the property-side matcher (Property → Comps tab),
 * not a general browse. The general browse is `getCompsPaginated` below. It
 * previously carried unreachable "browse-all" branches that took 6,000–12,000
 * rows in one read; no caller ever hit them, and they were a hazard sitting in
 * a table headed for ~260k rows, so they're gone.
 */
export const getComps = query({
  args: {
    suburb: v.string(),
    type: v.optional(compTypeValidator),
    assetType: v.optional(v.string()),
  },
  handler: async (ctx, { suburb, type, assetType }) => {
    await requireStaffOrAdmin(ctx);

    // Most specific index available.
    if (assetType && type) {
      return ctx.db
        .query("comps")
        .withIndex("by_suburb_assetType_type", q =>
          q.eq("suburb", suburb).eq("assetType", assetType).eq("type", type)
        )
        .take(500);
    }
    if (type) {
      return ctx.db
        .query("comps")
        .withIndex("by_suburb_and_type", q => q.eq("suburb", suburb).eq("type", type))
        .take(500);
    }
    return ctx.db
      .query("comps")
      .withIndex("by_suburb", q => q.eq("suburb", suburb))
      .take(500);
  },
});

/**
 * Paginated browse for the Comps page. Indexed by source/type, ordered
 * newest-first, with the secondary filters applied server-side so each page of
 * 50 is 50 rows that actually match. Scales to the full ~260k table.
 */
export const getCompsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(compTypeValidator),
    source: v.optional(v.string()),
    ...compFilterArgs,
  },
  handler: async (ctx, { paginationOpts, type, source, ...filters }) => {
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
    if (hasCompFilters(filters)) q = q.filter(f => compFilterPredicate(f, filters));
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
    ...compFilterArgs,
  },
  handler: async (ctx, { paginationOpts, query, type, source, ...filters }) => {
    await requireStaffOrAdmin(ctx);
    let q = ctx.db
      .query("comps")
      .withSearchIndex("search_text", s => {
        let b = s.search("searchText", query.toLowerCase());
        if (type) b = b.eq("type", type);
        if (source) b = b.eq("source", source);
        return b;
      });
    if (hasCompFilters(filters)) q = q.filter(f => compFilterPredicate(f, filters));
    return await q.paginate(paginationOpts);
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

/**
 * Suggested comps to attach to a property, matched from the comp database by
 * suburb (+ asset type when known) and ranked by asset-type match, size
 * closeness, then recency. Only returns UNLINKED comps (available to attach —
 * won't steal evidence already tied to another property). Powers the "Add
 * comps → Suggested" panel on the Feaso Assessment sub-tab.
 */
export const suggestCompsForProperty = query({
  args: { propertyId: v.id("properties") },
  handler: async (ctx, { propertyId }) => {
    await requireStaffOrAdmin(ctx);
    const property = await ctx.db.get(propertyId);
    if (!property) return { suburb: null, state: null, assetType: null, sales: [], leases: [] };
    const suburb = property.suburb;
    const state = property.location; // e.g. "VIC"
    const assetType = property.assetType;
    const nla = property.buildingArea;
    if (!suburb && !state) return { suburb: null, state: null, assetType: assetType ?? null, sales: [], leases: [] };

    const dateOf = (r) => r.saleDate || r.leaseDate || "";
    const pool = async (type) => {
      const rows = [];
      const seen = new Set();
      const add = (arr) => { for (const m of arr) if (!seen.has(m._id)) { seen.add(m._id); rows.push(m); } };

      // 1. Exact suburb matches first (guaranteed — never crowded out by the wider net).
      if (suburb && assetType) {
        add(await ctx.db.query("comps")
          .withIndex("by_suburb_assetType_type", (q) => q.eq("suburb", suburb).eq("assetType", assetType).eq("type", type))
          .take(50));
      } else if (suburb) {
        add(await ctx.db.query("comps")
          .withIndex("by_suburb_and_type", (q) => q.eq("suburb", suburb).eq("type", type))
          .take(50));
      }
      // 2. Widen: same state + asset type (nearby suburbs across the state).
      if (state && assetType) {
        add(await ctx.db.query("comps")
          .withIndex("by_state_assetType_type", (q) => q.eq("state", state).eq("assetType", assetType).eq("type", type))
          .take(200));
      }

      const ranked = rows
        .filter((r) => !r.linkedPropertyId) // only unlinked = available to attach
        .sort((a, b) => {
          const sub = (a.suburb === suburb ? 0 : 1) - (b.suburb === suburb ? 0 : 1); // exact suburb leads
          if (sub !== 0) return sub;
          if (nla && a.nlaSqm && b.nlaSqm) { // then closest in size
            const d = Math.abs(a.nlaSqm - nla) - Math.abs(b.nlaSqm - nla);
            if (d !== 0) return d;
          }
          return dateOf(b).localeCompare(dateOf(a)); // then most recent
        })
        .slice(0, 14);
      return ranked.map((r) => ({ ...r, sameSuburb: r.suburb === suburb }));
    };

    const [sales, leases] = [await pool("sale"), await pool("lease")];
    return { suburb: suburb ?? null, state: state ?? null, assetType: assetType ?? null, sales, leases };
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
      searchText: compSearchText(args),
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
        searchText: compSearchText(comp),
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

    // searchText must reflect the document AFTER the patch — a partial update
    // that only changes suburb still has to rebuild the whole blob.
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Comp not found");

    await ctx.db.patch(id, {
      ...fields,
      rentPa,
      rentPerSqm,
      pricePerSqmBuild,
      pricePerSqmLand,
      searchText: compSearchText({ ...existing, ...fields }),
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
