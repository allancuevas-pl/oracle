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
    role: v.union(v.literal("admin"), v.literal("staff")),
    invitedBy: v.string(),
    clerkInvitationId: v.optional(v.string()),
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
 * Remove a team member by downgrading their role to "client" (blocks app access).
 * We keep the user record so that re-signing-in doesn't auto-restore access.
 * Admin-only; cannot remove yourself.
 */
export const removeMember = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { user: caller } = await requireAdmin(ctx);
    if (caller._id === args.userId) {
      throw new Error("Cannot remove yourself from the team");
    }
    await ctx.db.patch(args.userId, { role: "client" });
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
    role: v.union(v.literal("admin"), v.literal("staff")),
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
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const errMsg =
        body.errors?.[0]?.long_message ||
        body.errors?.[0]?.message ||
        `Clerk API error (${response.status})`;
      throw new Error(errMsg);
    }

    const invitation = await response.json();

    await ctx.runMutation(internal.team.storePendingInvitation, {
      email,
      role: args.role,
      invitedBy: currentUser.clerkId,
      clerkInvitationId: invitation.id,
    });

    return { success: true };
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
