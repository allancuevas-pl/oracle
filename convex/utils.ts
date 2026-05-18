import { MutationCtx } from "./_generated/server";

export async function generateId(ctx: MutationCtx, prefix: string): Promise<string> {
  const counter = await ctx.db
    .query("idCounters")
    .withIndex("by_prefix", (q) => q.eq("prefix", prefix))
    .first();

  let nextCount = 1;

  if (counter) {
    nextCount = counter.count + 1;
    await ctx.db.patch(counter._id, { count: nextCount });
  } else {
    await ctx.db.insert("idCounters", { prefix, count: nextCount });
  }

  // Format as ORC-B0001
  const paddedCount = nextCount.toString().padStart(4, "0");
  return `ORC-${prefix}${paddedCount}`;
}
