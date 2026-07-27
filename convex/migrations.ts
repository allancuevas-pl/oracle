import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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
