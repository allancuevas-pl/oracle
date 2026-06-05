import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Crown, Shield, Trash2, Users, UserPlus, Loader2, Mail, MailOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { CustomSelect } from '../ui/CustomSelect';

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20">
        <Crown className="w-2.5 h-2.5" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-brand-100/50 border border-white/[0.08]">
      <Shield className="w-2.5 h-2.5" />
      Agent
    </span>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({ member, isSelf, isAdmin, onRoleChange, onRemove }) {
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);

  const initials = [member.firstName, member.lastName]
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || member.email?.[0]?.toUpperCase() || '?';

  const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Unknown';

  const handleRoleChange = async (newRole) => {
    if (newRole === member.role) return;
    setChanging(true);
    try {
      await onRoleChange(member._id, newRole);
      toast.success('Role updated');
    } catch (e) {
      toast.error('Failed to update role', { description: e.message });
    } finally {
      setChanging(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove(member._id);
      toast.success(`${fullName} removed from team`);
    } catch (e) {
      toast.error('Failed to remove member', { description: e.message });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-brand-400">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-brand-50 truncate">{fullName}</p>
          {isSelf && (
            <span className="text-[10px] text-brand-100/30 font-medium">(you)</span>
          )}
        </div>
        <p className="text-xs text-brand-100/35 truncate">{member.email}</p>
      </div>
      {isAdmin && !isSelf ? (
        <CustomSelect
          value={member.role}
          onChange={handleRoleChange}
          options={[
            { value: 'admin', label: 'Admin' },
            { value: 'staff', label: 'Agent' },
          ]}
          variant="compact"
          disabled={changing}
          className="w-28"
        />
      ) : (
        <RoleBadge role={member.role} />
      )}
      {isAdmin && !isSelf && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-brand-100/20 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
          title="Remove from team"
        >
          {removing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────

export function TeamSection({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  const members = useQuery(api.team.getTeamMembers);
  const pendingInvites = useQuery(api.team.getPendingInvitations, isAdmin ? {} : 'skip');

  const updateRole = useMutation(api.team.updateMemberRole);
  const removeFromTeam = useMutation(api.team.removeMember);
  const sendInvite = useAction(api.team.inviteTeamMember);
  const revokeInvite = useAction(api.team.revokePendingInvitation);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      await sendInvite({ email, role: inviteRole });
      setInviteEmail('');
      toast.success('Invitation sent', {
        description: `An invite email was sent to ${email}.`,
        duration: 4000,
      });
    } catch (e) {
      toast.error('Invite failed', { description: e.message, duration: 5000 });
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (invite) => {
    try {
      await revokeInvite({
        invitationId: invite._id,
        clerkInvitationId: invite.clerkInvitationId,
      });
      toast.info('Invitation revoked');
    } catch (e) {
      toast.error('Failed to revoke', { description: e.message });
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06]">
      {/* Header */}
      <div className="bg-[#0D0D0D] px-5 py-3 border-b border-white/[0.06] rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <Users className="w-3.5 h-3.5 text-brand-500" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
            Team Members
          </p>
        </div>
      </div>

      {/* Members list */}
      {members === undefined ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-brand-100/30">No team members found.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {members.map((member) => (
            <MemberRow
              key={member._id}
              member={member}
              isSelf={member.clerkId === currentUser?.clerkId}
              isAdmin={isAdmin}
              onRoleChange={(userId, role) => updateRole({ userId, role })}
              onRemove={(userId) => removeFromTeam({ userId })}
            />
          ))}
        </div>
      )}

      {/* Pending invitations — admin only */}
      {isAdmin && pendingInvites && pendingInvites.length > 0 && (
        <div className="border-t border-white/[0.06]">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/30">
              Pending Invitations
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {pendingInvites.map((invite) => (
              <div key={invite._id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <MailOpen className="w-3.5 h-3.5 text-brand-100/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand-100/60 truncate">{invite.email}</p>
                  <p className="text-xs text-brand-100/25">Invite pending</p>
                </div>
                <RoleBadge role={invite.role} />
                <button
                  onClick={() => handleRevoke(invite)}
                  className="text-brand-100/20 hover:text-red-400 transition-colors shrink-0"
                  title="Revoke invitation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form — admin only */}
      {isAdmin && (
        <div className="border-t border-white/[0.06] p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-3.5 h-3.5 text-brand-100/40" />
            <p className="text-xs font-semibold text-brand-100/60">Invite a team member</p>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="colleague@example.com"
              className="flex-1 bg-[#111] border border-brand-800/40 rounded-md px-3 py-2 text-xs text-brand-50 placeholder:text-brand-100/20 focus:border-brand-500/50 focus:outline-none transition-colors"
              autoComplete="off"
            />
            <CustomSelect
              value={inviteRole}
              onChange={setInviteRole}
              options={[
                { value: 'staff', label: 'Agent' },
                { value: 'admin', label: 'Admin' },
              ]}
              variant="compact"
              className="w-24"
            />
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-brand-950 bg-brand-500 hover:bg-brand-400 disabled:opacity-25 disabled:cursor-not-allowed rounded-md transition-all whitespace-nowrap"
            >
              {inviting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              Send Invite
            </button>
          </div>
          <p className="text-[10px] text-brand-100/20">
            Clerk sends the invite email. Requires{' '}
            <code className="font-mono">CLERK_SECRET_KEY</code> in Convex environment variables.
          </p>
        </div>
      )}
    </div>
  );
}
