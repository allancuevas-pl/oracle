import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { compSearchText } from "./comps";

export const insertMockUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    role: v.union(v.literal("staff"), v.literal("client"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      role: args.role,
    });
  },
});

/** Insert a comp directly for tests (bypasses the staff/admin gate). */
export const insertMockComp = internalMutation({
  args: {
    type: v.union(v.literal("lease"), v.literal("sale")),
    address: v.string(),
    suburb: v.string(),
    state: v.optional(v.string()),
    assetType: v.optional(v.string()),
    nlaSqm: v.optional(v.number()),
    landAreaSqm: v.optional(v.number()),
    saleDate: v.optional(v.string()),
    leaseDate: v.optional(v.string()),
    source: v.optional(v.union(
      v.literal("agent_call"),
      v.literal("real_commercial"),
      v.literal("loopnet"),
      v.literal("im_scan"),
      v.literal("comp_scan"),
      v.literal("historical_import"),
      v.literal("arealytics"),
      v.literal("property_lions"),
      v.literal("other"),
    )),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("comps", {
      ...args,
      source: args.source ?? "historical_import",
      // Mirror the real write path — comps without searchText don't just miss
      // the search index, they break it.
      searchText: compSearchText(args),
      verified: false,
      createdBy: "test",
    });
  },
});

/**
 * Build a complete client → brief → property → dealReport chain for portal
 * access-control tests. Deal-vault files are added by the test via t.run(),
 * which can store real blobs so ctx.storage.getUrl() resolves.
 */
export const seedPortalDeal = internalMutation({
  args: {
    clientEmail: v.optional(v.string()),   // omit to create a brief with NO client link
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const clientId = args.clientEmail
      ? await ctx.db.insert("clients", {
          name: "Test Client",
          email: args.clientEmail,
          createdBy: "test",
        })
      : undefined;

    const briefId = await ctx.db.insert("briefs", {
      clientName: "Test Client",
      clientId,
      stage: "Triage",
      status: "active",
      createdBy: "test",
    });

    const propertyId = await ctx.db.insert("properties", {
      address: "1 Vault Street",
      assetType: "Industrial",
      status: "Off Market",
      createdBy: "test",
    });

    await ctx.db.insert("dealReports", {
      briefId,
      propertyId,
      clientName: "Test Client",
      propertyAddress: "1 Vault Street",
      token: args.token,
      status: "sent",
      createdBy: "test",
    });

    return { token: args.token, propertyId, briefId };
  },
});
