import { query, mutation } from "./_generated/server";

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    let settings = await ctx.db.query("settings").first();
    
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
      };
    }
    
    return settings;
  },
});

export const updateDebtStructures = mutation({
  args: {},
  handler: async (ctx) => {
    let settings = await ctx.db.query("settings").first();
    if (settings) {
      await ctx.db.patch(settings._id, {
        debtStructures: ["Lease Doc", "Full Doc", "Cash", "Other"]
      });
    }
  }
});
