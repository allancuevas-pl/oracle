import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { UserPlus, RotateCcw, XCircle, CheckCircle2, Clock, Loader2, Mail, Ban, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Portal-access panel for a client record (ClientView left column).
 *
 * Status comes from TWO sources, reconciled:
 *   - getClientPortalStatus (reactive query) — local account role + pending row;
 *     drives which action IDs we have (revoke needs the local ids).
 *   - getPortalInviteDetail (action) — Clerk's TRUE invitation lifecycle
 *     (pending / accepted / revoked / expired) + dates. Clerk wins for display,
 *     because the local pending row is deleted on first sign-in and was seeded
 *     for existing users during the prod-Clerk cutover (so it can lie).
 *
 * States: Not invited -> Invite · Pending/Accepted -> Resend / Revoke ·
 *         Active (signed in) -> Resend / Revoke access · Revoked/Expired -> Re-invite.
 * All actions are admin-only server-side; errors surface as toasts.
 */

const fmtDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export function ClientPortalAccess({ client }) {
  const email = client?.email;
  const status = useQuery(api.team.getClientPortalStatus, email ? { email } : 'skip');

  const invite = useAction(api.team.inviteTeamMember);
  const resend = useAction(api.team.resendPortalInvite);
  const revokeInvite = useAction(api.team.revokePendingInvitation);
  const revokeAccess = useMutation(api.team.removeMember);
  const fetchDetail = useAction(api.team.getPortalInviteDetail);

  const [busy, setBusy] = useState(null); // 'invite' | 'resend' | 'revoke'
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [detail, setDetail] = useState(null); // Clerk truth (null until first load)

  const loadDetail = useCallback(async () => {
    if (!email) return;
    try {
      setDetail(await fetchDetail({ email }));
    } catch {
      setDetail(null);
    }
  }, [email, fetchDetail]);

  // Load Clerk truth on mount / when the email changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!email) return;
      try {
        const d = await fetchDetail({ email });
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

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
      loadDetail(); // refresh Clerk truth after any action
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

  const isActive = status?.account?.role === 'client';
  const isTeam = status?.account?.role === 'staff' || status?.account?.role === 'admin';
  const pending = status?.pendingInvite;
  const clerkStatus = detail?.found ? detail.status : null; // pending|accepted|revoked|expired
  const detailReady = detail !== null;

  // Reconcile local + Clerk into one display state. Clerk wins once loaded; while
  // it's still loading we fall back to the local pending row (avoids a flash of
  // "Not invited" for a genuinely-pending client).
  const state =
    status === undefined ? 'loading'
    : isActive ? 'active'
    : clerkStatus ? clerkStatus
    : (!detailReady && pending) ? 'pending'
    : 'none';

  const badge = {
    loading:  { label: 'Checking…',        icon: Loader2,       cls: 'text-brand-100/40 bg-white/[0.03] border-white/[0.06]', spin: true },
    active:   { label: 'Active',           icon: CheckCircle2,  cls: 'text-emerald-400 bg-emerald-900/15 border-emerald-800/30' },
    accepted: { label: 'Accepted',         icon: CheckCircle2,  cls: 'text-emerald-400 bg-emerald-900/15 border-emerald-800/30' },
    pending:  { label: 'Invited · pending', icon: Clock,        cls: 'text-brand-400 bg-brand-900/20 border-brand-800/30' },
    revoked:  { label: 'Invite revoked',   icon: Ban,           cls: 'text-red-400 bg-red-900/15 border-red-800/30' },
    expired:  { label: 'Invite expired',   icon: AlertTriangle, cls: 'text-amber-400 bg-amber-900/15 border-amber-800/30' },
    none:     { label: 'Not invited',      icon: XCircle,       cls: 'text-brand-100/40 bg-white/[0.03] border-white/[0.06]' },
  }[state];
  const BadgeIcon = badge.icon;

  // Human detail line under the badge (dates from Clerk).
  const invitedAt = fmtDate(detail?.invitedAt);
  const respondedAt = fmtDate(detail?.updatedAt);
  const expiresAt = fmtDate(detail?.expiresAt);
  const detailLine =
    state === 'active'   ? (respondedAt ? `Accepted ${respondedAt}` : invitedAt ? `Invited ${invitedAt}` : 'Signed in')
    : state === 'accepted' ? `Accepted ${respondedAt || ''}`.trim()
    : state === 'pending'  ? (invitedAt ? `Invited ${invitedAt}` : null)
    : state === 'revoked'  ? (respondedAt ? `Revoked ${respondedAt}` : 'Invitation revoked')
    : state === 'expired'  ? (expiresAt ? `Expired ${expiresAt}` : 'Invitation expired')
    : null;

  const btn = 'flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 w-full';
  const showInvite = state === 'none' || state === 'revoked' || state === 'expired';
  const showManage = state === 'pending' || state === 'accepted' || state === 'active';
  const reinvite = state === 'revoked' || state === 'expired';

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
          {detailLine && (
            <p className="text-[11px] text-brand-100/45">{detailLine}</p>
          )}
          {detail?.configured === false && (
            <p className="text-[11px] text-amber-400/70 italic">Clerk key not set — showing local status only.</p>
          )}

          {showInvite && (
            <button
              onClick={() => run('invite', () => invite({ email, role: 'client', clientRecordId: client._id }), `Portal invite sent to ${email}`)}
              disabled={busy !== null}
              className={`${btn} bg-brand-500/10 border border-brand-500/25 hover:bg-brand-500/20 text-brand-400 hover:text-brand-300`}
            >
              {busy === 'invite' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {reinvite ? 'Re-invite to Portal' : 'Invite to Portal'}
            </button>
          )}

          {showManage && (
            <>
              <button
                onClick={() => run('resend', () => resend({ email, clientRecordId: client._id }), `Invite re-sent to ${email}`)}
                disabled={busy !== null}
                className={`${btn} bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] text-brand-100/70 hover:text-brand-100`}
              >
                {busy === 'resend' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {state === 'pending' ? 'Revoke & resend' : 'Resend invite'}
              </button>

              <button
                onClick={() => {
                  if (!confirmRevoke) { setConfirmRevoke(true); return; }
                  if (status?.account?._id) {
                    run('revoke', () => revokeAccess({ userId: status.account._id }), `Portal access revoked for ${email}`);
                  } else if (pending) {
                    run('revoke', () => revokeInvite({ invitationId: pending._id, clerkInvitationId: pending.clerkInvitationId }), 'Invitation revoked');
                  } else {
                    // No local account or pending row (Clerk-only accepted state) — resend then revoke, or contact.
                    toast.error('Nothing to revoke locally. Resend, then revoke.');
                    setConfirmRevoke(false);
                  }
                }}
                disabled={busy !== null}
                className={`${btn} border ${confirmRevoke ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/[0.03] border-white/[0.08] text-brand-100/60 hover:text-red-400 hover:border-red-500/20'}`}
              >
                {busy === 'revoke' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                {confirmRevoke ? 'Click again to confirm' : (status?.account?._id ? 'Revoke access' : 'Revoke invite')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
