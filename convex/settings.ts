import { query } from "./_generated/server";
import { requireStaffOrAdmin } from "./authz";

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
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

