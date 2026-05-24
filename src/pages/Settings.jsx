import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  MapPin, Eye, EyeOff, Check, AlertCircle, ExternalLink,
  KeyRound, Trash2, Users, UserPlus, Loader2, Crown, Shield,
  Mail, MailOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { getGoogleMapsKey, setGoogleMapsKey } from '../hooks/useGoogleMaps';

// ─── API Key Card ─────────────────────────────────────────────────────────────

function ApiKeyCard({ title, icon: Icon, description, docsUrl, placeholder }) {
  const [currentKey, setCurrentKey] = useState(getGoogleMapsKey);
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);

  const maskedKey = currentKey
    ? `${currentKey.slice(0, 6)}${'•'.repeat(Math.max(0, currentKey.length - 10))}${currentKey.slice(-4)}`
    : '';

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setGoogleMapsKey(trimmed);
    setCurrentKey(trimmed);
    setInput('');
    toast.success('API key saved', {
      description: 'Address autocomplete is now active.',
      duration: 3000,
    });
  };

  const handleRemove = () => {
    setGoogleMapsKey('');
    setCurrentKey('');
    setInput('');
    setShow(false);
    toast.info('API key removed', { duration: 2500 });
  };

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Card header */}
      <div className="bg-[#0D0D0D] px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-brand-500" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
            {title}
          </p>
        </div>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-brand-100/30 hover:text-brand-100/60 transition-colors"
          >
            Docs
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-brand-100/45 leading-relaxed">{description}</p>

        {/* Current key status */}
        {currentKey ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/20">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <p className="text-xs text-brand-100/60 flex-1 font-mono truncate">
              {show ? currentKey : maskedKey}
            </p>
            <button
              onClick={() => setShow((v) => !v)}
              className="text-brand-100/25 hover:text-brand-100/60 transition-colors shrink-0"
              aria-label={show ? 'Hide key' : 'Reveal key'}
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleRemove}
              className="text-brand-100/20 hover:text-red-400 transition-colors shrink-0"
              aria-label="Remove key"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <AlertCircle className="w-3.5 h-3.5 text-brand-100/20 shrink-0" />
            <p className="text-xs text-brand-100/30">Not configured — feature is disabled.</p>
          </div>
        )}

        {/* Paste + save row */}
        <div>
          <div className="flex gap-2">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={placeholder || 'Paste your API key…'}
              className="flex-1 bg-[#111] border border-brand-800/40 rounded-md px-3 py-2 text-xs text-brand-50 placeholder:text-brand-100/20 font-mono focus:border-brand-500/50 focus:outline-none transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={handleSave}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-brand-950 bg-brand-500 hover:bg-brand-400 disabled:opacity-25 disabled:cursor-not-allowed rounded-md transition-all whitespace-nowrap"
            >
              Save Key
            </button>
          </div>
          <p className="text-[10px] text-brand-100/20 mt-2.5">
            Stored in your browser only — never sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
}

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
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-brand-400">{initials}</span>
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-brand-50 truncate">{fullName}</p>
          {isSelf && (
            <span className="text-[10px] text-brand-100/30 font-medium">(you)</span>
          )}
        </div>
        <p className="text-xs text-brand-100/35 truncate">{member.email}</p>
      </div>

      {/* Role */}
      {isAdmin && !isSelf ? (
        <select
          value={member.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={changing}
          className="bg-[#0D0D0D] border border-brand-800/40 rounded px-2 py-1 text-xs text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors disabled:opacity-40 cursor-pointer"
        >
          <option value="admin">Admin</option>
          <option value="staff">Agent</option>
        </select>
      ) : (
        <RoleBadge role={member.role} />
      )}

      {/* Remove */}
      {isAdmin && !isSelf && (
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-brand-100/20 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
          title="Remove from team"
        >
          {removing
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" />
          }
        </button>
      )}
    </div>
  );
}

// ─── Team Section ─────────────────────────────────────────────────────────────

function TeamSection({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  const members = useQuery(api.team.getTeamMembers);
  const pendingInvites = useQuery(
    api.team.getPendingInvitations,
    isAdmin ? {} : 'skip'
  );

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
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0D0D0D] px-5 py-3 border-b border-white/[0.06]">
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
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-[#111] border border-brand-800/40 rounded-md px-3 py-2 text-xs text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="staff">Agent</option>
              <option value="admin">Admin</option>
            </select>
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

// ─── Settings Page ────────────────────────────────────────────────────────────

export function Settings() {
  const currentUser = useQuery(api.users.getCurrentUser);

  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-8 py-10">

      {/* Page header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">
          Configuration
        </p>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-brand-100/40 mt-1">
          Manage workspace configuration and third-party integrations.
        </p>
      </div>

      {/* Team section */}
      <section className="space-y-4 mb-10">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand-100/30" />
            <h2 className="text-sm font-semibold text-brand-50">Team</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            Manage team members and send invitations. Admins can change roles and remove access.
          </p>
        </div>

        {currentUser === undefined ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
          </div>
        ) : (
          <TeamSection currentUser={currentUser} />
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-10" />

      {/* Integrations section */}
      <section className="space-y-4">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-brand-100/30" />
            <h2 className="text-sm font-semibold text-brand-50">Integrations</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            API keys for external services. Stored locally in this browser — not synced across devices.
          </p>
        </div>

        <ApiKeyCard
          title="Google Maps API"
          icon={MapPin}
          description="Enables address autocomplete when adding or editing properties. Requires a Google Maps Platform API key with the Places API enabled and an authorised domain."
          docsUrl="https://developers.google.com/maps/documentation/places/web-service/get-api-key"
          placeholder="AIzaSy…"
        />
      </section>

    </div>
  );
}
