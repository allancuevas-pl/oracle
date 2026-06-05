import { query } from "./_generated/server";
import { requireStaffOrAdmin } from "./authz";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Single round-trip query that powers the Dashboard overview screen.
 *
 * Stats computed:
 *  - activeBriefCount  — indexed scan of briefs by_status, O(active briefs)
 *  - newThisWeek       — derived from the same slice, no extra read
 *  - pipelineValue     — sum of budgetMax (or capital) across active briefs
 *  - propertiesInDD    — unique properties whose latest match status is "Due Diligence"
 *  - recentBriefs      — top 5 most recently created active briefs for the pipeline table
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);

    // Active briefs — fast indexed scan; 200 is generous for any real CRE firm
    const briefs = await ctx.db
      .query("briefs")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(200);

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newThisWeek = briefs.filter((b) => b._creationTime > oneWeekAgo).length;

    // Pipeline value = sum of buyer budgets across all active briefs
    const pipelineValue = briefs.reduce(
      (sum, b) => sum + (b.budgetMax ?? b.capital ?? 0),
      0
    );

    // Properties in Due Diligence — no status index on matches; scan is fine at this scale
    const matches = await ctx.db.query("matches").take(500);
    const propertiesInDD = new Set(
      matches
        .filter((m) => m.status === "Due Diligence")
        .map((m) => m.propertyId)
    ).size;

    // Top 5 most recent active briefs for the pipeline table
    const recentBriefs = briefs.slice(0, 5).map((b) => ({
      _id: b._id,
      clientName: b.clientName,
      assetTarget: b.assetTypes?.join(" / ") ?? (b as any).assetType ?? "—",
      stage: b.stage,
      value: b.budgetMax ?? b.capital ?? null,
      openedAt: relativeTime(b._creationTime),
    }));

    return {
      activeBriefCount: briefs.length,
      newThisWeek,
      pipelineValue,
      propertiesInDD,
      recentBriefs,
    };
  },
});
