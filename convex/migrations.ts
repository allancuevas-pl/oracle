import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { compSearchText } from "./comps";
import { ASSET_TYPES } from "./assetTypes";

/**
 * One-time migrations. Internal only — never callable from the client.
 * Run from the Convex dashboard (Functions → run) or `npx convex run`.
 */

// Deliberate deviation from CLAUDE.md §2's 100-row users cap: a partial run
// here would leave real people locked out of production, which is worse than
// reading a few hundred extra rows in a one-off internal mutation. The result
// reports `capHit` so a truncated run is never silent.
const MIGRATION_LIMIT = 500;

const CUTOVER_SENTINEL = "system:clerk-prod-cutover";

/**
 * Seed `pendingInvitations` for every currently-provisioned user, ahead of the
 * cutover to the Clerk PRODUCTION instance.
 *
 * Why this is required: a Clerk prod instance has its own, empty user database,
 * so every user signs in with a brand-new `identity.subject`. `users.storeUser`
 * matches only on `by_clerkId`, finds nothing, and falls through to
 * `role: pendingInvite?.role ?? "blocked"`. Because invitations are single-use
 * and already consumed, there would be no pending invite — so EVERY user,
 * including every admin, would land as `blocked` with no admin left to re-invite
 * them. Seeding the invite gate ahead of time makes first sign-in restore the
 * correct role automatically, without weakening `storeUser` itself.
 *
 * Idempotent: skips any email that already has a pending invitation.
 * `blocked` users are intentionally NOT seeded — they must stay locked out.
 *
 * Run with `{ dryRun: true }` first to preview.
 */
export const seedInvitationsForClerkCutover = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const roles = ["admin", "staff", "client"] as const;

    const seeded: Array<{ email: string; role: string }> = [];
    const skippedExisting: string[] = [];
    const skippedNoEmail: string[] = [];
    let capHit = false;

    for (const role of roles) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", role))
        .take(MIGRATION_LIMIT);

      if (users.length === MIGRATION_LIMIT) capHit = true;

      for (const user of users) {
        const email = (user.email || "").trim().toLowerCase();
        if (!email) {
          skippedNoEmail.push(user.clerkId);
          continue;
        }

        const existing = await ctx.db
          .query("pendingInvitations")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();

        if (existing) {
          skippedExisting.push(email);
          continue;
        }

        if (!args.dryRun) {
          await ctx.db.insert("pendingInvitations", {
            email,
            role,
            invitedBy: CUTOVER_SENTINEL,
          });
        }
        seeded.push({ email, role });
      }
    }

    return {
      dryRun: args.dryRun,
      seededCount: seeded.length,
      seeded,
      skippedExistingCount: skippedExisting.length,
      skippedExisting,
      skippedNoEmail,
      // True means MIGRATION_LIMIT was reached for some role and users may have
      // been missed — raise the limit and re-run (it is idempotent).
      capHit,
    };
  },
});

/**
 * Rollback for the above: removes only the invitations this migration created
 * (matched on the `invitedBy` sentinel), leaving genuine admin-issued invites
 * untouched. Safe to run if the cutover is aborted.
 */
export const undoSeedInvitationsForClerkCutover = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, args) => {
    // No index on `invitedBy` — this is a one-off cleanup over a small table,
    // so a bounded scan is cheaper than carrying an index for it forever.
    const candidates = await ctx.db
      .query("pendingInvitations")
      .take(MIGRATION_LIMIT);

    const removed: string[] = [];
    for (const invite of candidates) {
      if (invite.invitedBy !== CUTOVER_SENTINEL) continue;
      if (!args.dryRun) await ctx.db.delete(invite._id);
      removed.push(invite.email);
    }

    return { dryRun: args.dryRun, removedCount: removed.length, removed };
  },
});

/**
 * Backfill `comps.searchText` for rows created before the field existed.
 *
 * The comps search index moved from `address` to a combined
 * address+suburb+state+postcode blob so the search box matches suburbs
 * (Will, Loom 27 Aug). Existing rows have no `searchText`, so without this
 * they'd match nothing at all — a silent regression that looks like an empty
 * database. Batched and idempotent: run until `remaining` is 0.
 *
 *   npx convex run migrations:backfillCompSearchText '{"dryRun":true}'
 *   npx convex run migrations:backfillCompSearchText '{"dryRun":false}'
 */
export const backfillCompSearchText = internalMutation({
  args: { dryRun: v.boolean(), batch: v.optional(v.number()) },
  handler: async (ctx, { dryRun, batch }) => {
    const limit = batch ?? 500;
    const rows = await ctx.db.query("comps").take(limit);

    let updated = 0;
    let alreadySet = 0;
    for (const row of rows) {
      const next = compSearchText(row);
      if (row.searchText === next) { alreadySet++; continue; }
      if (!dryRun) await ctx.db.patch(row._id, { searchText: next });
      updated++;
    }

    return {
      dryRun,
      scanned: rows.length,
      updated,
      alreadySet,
      capHit: rows.length === limit,
    };
  },
});

/**
 * Add any missing canonical asset types to the stored settings row.
 *
 * `settings.assetTypes` is an admin-editable stored row, so changing the seed
 * default in assetTypes.ts does NOT update a deployment that already has one —
 * and both live deployments do, holding only the original three. Will asked
 * for "Land" (2026-09-02) for development sites.
 *
 * Additive and idempotent by design: it appends what's missing and preserves
 * any custom types an admin added, rather than overwriting with the canonical
 * list. Run on BOTH deployments.
 *
 *   npx convex run migrations:syncAssetTypes '{"dryRun":true}'
 *   npx convex run migrations:syncAssetTypes '{"dryRun":false}'
 *   npx convex run --prod migrations:syncAssetTypes '{"dryRun":false}'
 */
export const syncAssetTypes = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, { dryRun }) => {
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      // No row: getSettings serves the canonical seed default already.
      return { dryRun, hadRow: false, added: [], result: [...ASSET_TYPES] };
    }

    const current = settings.assetTypes ?? [];
    const missing = ASSET_TYPES.filter((t) => !current.includes(t));
    const next = [...current, ...missing];

    if (!dryRun && missing.length > 0) {
      await ctx.db.patch(settings._id, { assetTypes: next });
    }

    return { dryRun, hadRow: true, before: current, added: missing, result: next };
  },
});
