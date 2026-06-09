import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireStaffOrAdmin, requireAdmin } from "./authz";

export const DEFAULT_ORACLE_MODEL = "claude-sonnet-4-5";

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const settings = await ctx.db.query("settings").first();

    // Auto-seed default settings if none exist
    if (!settings) {
      return {
        assetTypes: ["Industrial", "Retail", "Office"],
        strategies: [
          "Rental Reversion Upside",
          "Strata Subdivision",
          "Refurb & Reposition",
          "Option"
        ],
        locations: ["VIC", "QLD", "NSW", "WA", "SA", "TAS", "ACT", "NT"],
        debtStructures: ["Lease Doc", "Full Doc", "Cash", "Other"],
        oracleModel: DEFAULT_ORACLE_MODEL,
      };
    }

    return settings;
  },
});

export const getOracleModel = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const settings = await ctx.db.query("settings").first();
    return settings?.oracleModel ?? DEFAULT_ORACLE_MODEL;
  },
});

export const setOracleModel = mutation({
  args: { model: v.string() },
  handler: async (ctx, { model }) => {
    await requireAdmin(ctx);
    const settings = await ctx.db.query("settings").first();
    if (settings) {
      await ctx.db.patch(settings._id, { oracleModel: model });
    } else {
      await ctx.db.insert("settings", {
        assetTypes: ["Industrial", "Retail", "Office"],
        strategies: [
          "Rental Reversion Upside",
          "Strata Subdivision",
          "Refurb & Reposition",
          "Option"
        ],
        locations: ["VIC", "QLD", "NSW", "WA", "SA", "TAS", "ACT", "NT"],
        debtStructures: ["Lease Doc", "Full Doc", "Cash", "Other"],
        oracleModel: model,
      });
    }
  },
});
