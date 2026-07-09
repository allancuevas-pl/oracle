import React, { useState } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { UserPlus, RotateCcw, XCircle, CheckCircle2, Clock, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Portal-access panel for a client record (ClientView left column).
 * Shows current state and the right actions:
 *   Not invited -> Invite
 *   Pending     -> Resend (revoke old link + re-send) / Revoke
 *   Active       -> Resend / Revoke access (sets the user to "blocked")
 * All actions are admin-only server-side; errors surface as toasts.
 */
export function ClientPortalAccess({ client }) {
  const email = client?.email;
  const status = useQuery(
    api.team.getClientPortalStatus,
    email ? { email } : 'skip'
  );

  const invite = useAction(api.team.inviteTeamMember);
  const resend = useAction(api.team.resendPortalInvite);
  const revokeInvite = useAction(api.team.revokePendingInvitation);
  const revokeAccess = useMutation(api.team.removeMember);

  const [busy, setBusy] = useState(null); // 'invite' | 'resend' | 'revoke'
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const run = async (key, fn, successMsg) => {
    setBusy(key);
    try {
      const result = await fn();
      // invite/resend return { alreadyHasAccount }. Clerk sends NO email to an
      // address that already has an account, so don't claim an email went out.
      if (result?.alreadyHasAccount) {
        toast.success(`${email} already has an account — no email sent, they can sign in directly`);
      } else if (successMsg) {
        toast.success(successMsg);
      }
    } catch (err) {
      const msg = err?.message || 'Action failed';
      if (msg.includes('taken') || msg.includes('already')) {
        toast.success(`${email} already has an account — they can sign in, no email needed`);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
      setConfirmRevoke(false);
    }
  };

  if (!email) {
    return (
      <div className="pt-5 border-t border-white/5 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Portal Access</h3>
        <p className="text-sm text-brand-100/45 italic flex items-center gap-2">
          <Mail className="w-4 h-4 shrink-0" />
          Add an email to enable portal access.
        </p>
      </div>
    );
  }

  // Derive state. An active client account takes precedence over a stale invite.
  const isActive = status?.account?.role === 'client';
  const isTeam = status?.account?.role === 'staff' || status?.account?.role === 'admin';
  const pending = status?.pendingInvite;
  const state = status === undefined
    ? 'loading'
    : isActive
    ? 'active'
    : pending
    ? 'pending'
    : 'none';

  const badge = {
    loading: { label: 'Checking…', icon: Loader2, cls: 'text-brand-100/40 bg-white/[0.03] border-white/[0.06]', spin: true },
    active:  { label: 'Active',     icon: CheckCircle2, cls: 'text-emerald-400 bg-emerald-900/15 border-emerald-800/30' },
    pending: { label: 'Invited · pending', icon: Clock, cls: 'text-brand-400 bg-brand-900/20 border-brand-800/30' },
    none:    { label: 'Not invited', icon: XCircle, cls: 'text-brand-100/40 bg-white/[0.03] border-white/[0.06]' },
  }[state];
  const BadgeIcon = badge.icon;

  const btn = 'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 w-full';

  return (
    <div className="pt-5 border-t border-white/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Portal Access</h3>
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badge.cls}`}>
          <BadgeIcon className={`w-3 h-3 ${badge.spin ? 'animate-spin' : ''}`} />
          {badge.label}
        </span>
      </div>

      {isTeam ? (
        <p className="text-xs text-brand-100/45 italic">
          This email belongs to a team member, so portal access does not apply.
        </p>
      ) : state === 'loading' ? null : (
        <div className="space-y-2">
          {state === 'none' && (
            <button
              onClick={() => run('invite', () => invite({ email, role: 'client', clientRecordId: client._id }), `Portal invite sent to ${email}`)}
              disabled={busy !== null}
              className={`${btn} bg-brand-500/10 border border-brand-500/25 hover:bg-brand-500/20 text-brand-400 hover:text-brand-300`}
            >
              {busy === 'invite' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Invite to Portal
            </button>
          )}

          {(state === 'pending' || state === 'active') && (
            <>
              <button
                onClick={() => run('resend', () => resend({ email, clientRecordId: client._id }), `Invite re-sent to ${email}`)}
                disabled={busy !== null}
                className={`${btn} bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-brand-100/70 hover:text-brand-100`}
              >
                {busy === 'resend' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {state === 'active' ? 'Resend invite' : 'Revoke & resend'}
              </button>

              <button
                onClick={() => {
                  if (!confirmRevoke) { setConfirmRevoke(true); return; }
                  if (state === 'active') {
                    run('revoke', () => revokeAccess({ userId: status.account._id }), `Portal access revoked for ${email}`);
                  } else {
                    run('revoke', () => revokeInvite({ invitationId: pending._id, clerkInvitationId: pending.clerkInvitationId }), 'Invitation revoked');
                  }
                }}
                disabled={busy !== null}
                className={`${btn} border ${confirmRevoke ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/[0.03] border-white/[0.08] text-brand-100/60 hover:text-red-400 hover:border-red-500/20'}`}
              >
                {busy === 'revoke' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                {confirmRevoke ? 'Click again to confirm' : state === 'active' ? 'Revoke access' : 'Revoke invite'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
