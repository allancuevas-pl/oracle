import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Plus, X, Users } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { toast } from 'sonner';

const ROLE_OPTIONS = ['Lead Agent', 'Support', 'Admin'];

function userInitials(user) {
  if (!user) return '?';
  const first = user.firstName?.[0] ?? '';
  const last = user.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
}

function userName(user) {
  if (!user) return 'Unknown';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.email || 'Unknown';
}

export function AssigneePicker({ briefId, enrichedAssignees = [] }) {
  const allUsers = useQuery(api.users.getUsers);
  const updateAssignees = useMutation(api.briefs.updateAssignees);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('Lead Agent');
  const [saving, setSaving] = useState(null); // userId being removed

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isAdding) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsAdding(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isAdding]);

  // Users not yet assigned
  const assignedIds = new Set(enrichedAssignees.map(a => a.userId));
  const available = (allUsers ?? []).filter(u => !assignedIds.has(u._id));

  async function handleAdd() {
    if (!selectedUserId) return;
    const user = allUsers?.find(u => u._id === selectedUserId);
    const newAssignees = [
      ...enrichedAssignees.map(a => ({ userId: a.userId, role: a.role })),
      { userId: selectedUserId, role: selectedRole },
    ];
    try {
      await updateAssignees({ id: briefId, assignees: newAssignees });
      toast.success(`${userName(user)} added to team`);
      setSelectedUserId('');
      setSelectedRole('Lead Agent');
      setIsAdding(false);
    } catch {
      toast.error('Failed to update team');
    }
  }

  async function handleRemove(userId) {
    setSaving(userId);
    const newAssignees = enrichedAssignees
      .filter(a => a.userId !== userId)
      .map(a => ({ userId: a.userId, role: a.role }));
    try {
      await updateAssignees({ id: briefId, assignees: newAssignees });
    } catch {
      toast.error('Failed to remove team member');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-3.5 h-3.5 text-brand-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Team</h3>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-1 text-xs text-brand-100/50 hover:text-brand-400 transition-colors px-2 py-1 rounded hover:bg-brand-900/30"
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Current assignees */}
      {enrichedAssignees.length === 0 && !isAdding ? (
        <p className="text-xs text-brand-100/30 italic">No team members assigned.</p>
      ) : (
        <div className="space-y-2">
          {enrichedAssignees.map((a) => (
            <div
              key={a.userId}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-brand-400">
                    {userInitials(a.user)}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-brand-100">{userName(a.user)}</p>
                  <p className="text-[10px] text-brand-100/40">{a.role}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(a.userId)}
                disabled={saving === a.userId}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-brand-100/30 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {isAdding && (
        <div
          ref={dropdownRef}
          className="bg-[#111] border border-brand-800/50 rounded-lg p-3 space-y-3"
        >
          {/* User select */}
          <div>
            <label className="block text-[10px] text-brand-100/40 mb-1 uppercase tracking-wider">Staff Member</label>
            <CustomSelect
              value={selectedUserId}
              onChange={setSelectedUserId}
              options={available.map(u => ({ value: u._id, label: userName(u) }))}
              placeholder="Select person..."
              variant="compact"
            />
            {available.length === 0 && (
              <p className="text-[10px] text-brand-100/30 mt-1 italic">All staff members already assigned.</p>
            )}
          </div>

          {/* Role select */}
          <div>
            <label className="block text-[10px] text-brand-100/40 mb-1 uppercase tracking-wider">Role</label>
            <CustomSelect
              value={selectedRole}
              onChange={setSelectedRole}
              options={ROLE_OPTIONS}
              variant="compact"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setSelectedUserId(''); }}
              className="text-xs text-brand-100/50 hover:text-white transition-colors px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedUserId}
              className="bg-brand-500 disabled:opacity-40 hover:bg-brand-400 text-brand-950 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact avatar stack for list views
export function AvatarStack({ assignees, usersMap, max = 3 }) {
  if (!assignees?.length) return null;

  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <div className="flex -space-x-1.5 items-center">
      {visible.map((a) => {
        const user = usersMap?.[a.userId];
        const initials = user
          ? ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || user.email?.[0]?.toUpperCase() || '?'
          : '?';
        const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : '';
        return (
          <div
            key={a.userId}
            title={fullName ? `${fullName} · ${a.role}` : a.role}
            className="w-6 h-6 rounded-full bg-brand-500/15 border border-[#0A0A0A] flex items-center justify-center text-[9px] font-bold text-brand-400 shrink-0"
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full bg-brand-800/50 border border-[#0A0A0A] flex items-center justify-center text-[9px] font-bold text-brand-500 shrink-0">
          +{overflow}
        </div>
      )}
    </div>
  );
}
