import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { requireAdmin, requireStaffOrAdmin } from "./authz";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** All admin + staff users. Visible to all staff so they can see teammates. */
export const getTeamMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffOrAdmin(ctx);
    const [admins, staff] = await Promise.all([
      ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(100),
      ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "staff")).take(100),
    ]);
    return [...admins, ...staff];
  },
});

/** Pending (unsused) invitations. Admin-only. */
export const getPendingInvitations = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("pendingInvitations").take(100);
  },
});

// ─── Internal mutations (called from server-side actions only) ────────────────

export const storePendingInvitation = internalMutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff"), v.literal("client")),
    invitedBy: v.string(),
    clerkInvitationId: v.optional(v.string()),
    clientRecordId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    // Upsert: update if the same email was already invited
    const existing = await ctx.db
      .query("pendingInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        clerkInvitationId: args.clerkInvitationId,
        invitedBy: args.invitedBy,
      });
    } else {
      await ctx.db.insert("pendingInvitations", args);
    }
  },
});

/**
 * If a user already exists in our DB (email taken in Clerk), update their role
 * directly so they don't have to sign out/in to get the new role.
 */
export const upsertUserRole = internalMutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff"), v.literal("client")),
  },
  handler: async (ctx, { email, role }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return;
    // Guard: a client-portal invite must never demote an existing CRM user.
    // E.g. creating a client record with an admin's email shouldn't strip their
    // admin access. Team-role invites (staff/admin) are explicit and allowed.
    if (role === "client" && (user.role === "staff" || user.role === "admin")) {
      return;
    }
    await ctx.db.patch(user._id, { role });
  },
});

export const deletePendingInvitationById = internalMutation({
  args: { id: v.id("pendingInvitations") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Change the role of a team member. Admin-only; cannot change own role. */
export const updateMemberRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("staff")),
  },
  handler: async (ctx, args) => {
    const { user: caller } = await requireAdmin(ctx);
    if (caller._id === args.userId) {
      throw new Error("Cannot change your own role");
    }
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

/**
 * Remove a team member by downgrading their role to "blocked" — zero access
 * anywhere, CRM *and* client portal. We keep the user record so re-signing-in
 * doesn't auto-restore access. Admin-only; cannot remove yourself.
 *
 * NOTE: must be "blocked", not "client" — "client" grants portal access, which
 * would let a removed agent back in through the side door.
 */
export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { user: caller } = await requireAdmin(ctx);
    if (caller._id === args.userId) {
      throw new Error("Cannot remove yourself from the team");
    }
    await ctx.db.patch(args.userId, { role: "blocked" });
  },
});

// ─── Actions (external Clerk API calls) ──────────────────────────────────────

/**
 * Send a Clerk invitation email and record a pending invite.
 * Requires CLERK_SECRET_KEY to be set in Convex dashboard environment variables.
 */
export const inviteTeamMember = action({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("staff"), v.literal("client")),
    clientRecordId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can invite team members");
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      throw new Error(
        "CLERK_SECRET_KEY is not configured. Add it in the Convex dashboard → Settings → Environment Variables."
      );
    }

    const email = args.email.trim().toLowerCase();

    const response = await fetch("https://api.clerk.com/v1/invitations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        public_metadata: { role: args.role },
        // Clients land on their branded portal login; staff/admin invites also
        // resolve fine there (they get redirected onward post-auth by routing).
        redirect_url: args.role === "client"
          ? "https://oracle-psi-beryl.vercel.app/portal"
          : "https://oracle-psi-beryl.vercel.app",
      }),
    });

    let clerkInvitationId: string | undefined;

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const clerkCode = body.errors?.[0]?.code || "";
      const emailTaken =
        clerkCode === "duplicate_record" ||
        (body.errors?.[0]?.message || "").toLowerCase().includes("taken") ||
        (body.errors?.[0]?.long_message || "").toLowerCase().includes("taken");

      if (!emailTaken) {
        // Real Clerk error — bail out
        const errMsg =
          body.errors?.[0]?.long_message ||
          body.errors?.[0]?.message ||
          `Clerk API error (${response.status})`;
        throw new Error(errMsg);
      }
      // Email already has a Clerk account — still store/update the pending
      // invitation so storeUser picks up the correct role on their next sign-in.
    } else {
      const invitation = await response.json();
      clerkInvitationId = invitation.id;
    }

    // Also update any existing user record directly if they're already in our DB
    await ctx.runMutation(internal.team.upsertUserRole, {
      email,
      role: args.role,
    });

    await ctx.runMutation(internal.team.storePendingInvitation, {
      email,
      role: args.role,
      invitedBy: currentUser.clerkId,
      clerkInvitationId,
      clientRecordId: args.clientRecordId,
    });

    return { success: true, alreadyHasAccount: !clerkInvitationId };
  },
});

/**
 * Revoke a pending invitation — removes it from Convex and revokes the Clerk invite link.
 */
export const revokePendingInvitation = action({
  args: {
    invitationId: v.id("pendingInvitations"),
    clerkInvitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can revoke invitations");
    }

    // Best-effort revoke the Clerk invite link so the email link stops working
    if (args.clerkInvitationId) {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (clerkSecretKey) {
        await fetch(
          `https://api.clerk.com/v1/invitations/${args.clerkInvitationId}/revoke`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${clerkSecretKey}` },
          }
        ).catch(() => {});
      }
    }

    await ctx.runMutation(internal.team.deletePendingInvitationById, {
      id: args.invitationId,
    });

    return { success: true };
  },
});

/**
 * Portal-access status for a single client email, for the client record UI.
 * Staff/admin (read-only). Tells the UI which state to render:
 *   - pendingInvite present  -> "Invited (pending)"  (offer Resend / Revoke)
 *   - account.role === client -> "Active"            (offer Revoke access)
 *   - neither                 -> "Not invited"       (offer Invite)
 */
export const getClientPortalStatus = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    await requireStaffOrAdmin(ctx);
    const norm = email.trim().toLowerCase();
    if (!norm) return { pendingInvite: null, account: null };

    const [pending, user] = await Promise.all([
      ctx.db
        .query("pendingInvitations")
        .withIndex("by_email", (q) => q.eq("email", norm))
        .first(),
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", norm))
        .first(),
    ]);

    return {
      pendingInvite: pending
        ? {
            _id: pending._id,
            clerkInvitationId: pending.clerkInvitationId,
            role: pending.role,
          }
        : null,
      account: user ? { _id: user._id, role: user.role } : null,
    };
  },
});

/**
 * Resend a client's portal invite: revoke the old Clerk invite link (so the
 * previous email link stops working), then send a fresh invite. Admin-only.
 * Delegates the create path to inviteTeamMember so there is one source of truth.
 */
export const resendPortalInvite = action({
  args: {
    email: v.string(),
    clientRecordId: v.optional(v.id("clients")),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!currentUser || currentUser.role !== "admin") {
      throw new Error("Only admins can resend invitations");
    }

    const email = args.email.trim().toLowerCase();

    // Revoke the previous Clerk invite link, if any, before issuing a new one.
    const status = await ctx.runQuery(api.team.getClientPortalStatus, { email });
    const oldClerkId = status.pendingInvite?.clerkInvitationId;
    if (oldClerkId) {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (clerkSecretKey) {
        await fetch(
          `https://api.clerk.com/v1/invitations/${oldClerkId}/revoke`,
          { method: "POST", headers: { Authorization: `Bearer ${clerkSecretKey}` } }
        ).catch(() => {});
      }
    }

    // Re-issue. inviteTeamMember upserts the pending invitation + Clerk invite,
    // and already tolerates the "email already has an account" case.
    return await ctx.runAction(api.team.inviteTeamMember, {
      email,
      role: "client",
      clientRecordId: args.clientRecordId,
    });
  },
});
