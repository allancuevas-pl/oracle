import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Loader2, StickyNote, Zap, Send } from 'lucide-react';
import { toast } from 'sonner';

// ─── Relative time ────────────────────────────────────────────────
function timeAgo(ms) {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 60)  return 'just now';
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d < 7)   return `${d}d ago`;
  return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ─── Single activity row ──────────────────────────────────────────
function ActivityRow({ activity }) {
  const isNote = activity.type === 'note';

  return (
    <div className="relative flex gap-3">
      {/* Timeline dot */}
      <div className="shrink-0 mt-0.5">
        {isNote ? (
          <div className="w-6 h-6 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
            <StickyNote className="w-3 h-3 text-brand-500" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            <Zap className="w-3 h-3 text-brand-100/45" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
          isNote ? 'text-brand-50' : 'text-brand-100/50'
        }`}>
          {activity.content}
        </p>
        <p className="text-[10px] text-brand-100/40 mt-1">
          {activity.creatorName} · {timeAgo(activity._creationTime)}
        </p>
      </div>
    </div>
  );
}

// ─── PulseFeed ────────────────────────────────────────────────────
export function PulseFeed({ recordId, recordType }) {
  const activities = useQuery(
    api.activities.getActivities,
    recordId ? { recordId } : 'skip'
  );
  const addNote    = useMutation(api.activities.addNote);

  const [draft, setDraft]           = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await addNote({ recordId, recordType, content: trimmed });
      setDraft('');
      toast.success('Note saved');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-5 shrink-0">
        Activity
      </p>

      {/* Note composer */}
      <div className="shrink-0 mb-5">
        <div className="relative">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Leave a private note…"
            rows={3}
            className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-brand-50 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/30 resize-none transition-colors leading-relaxed"
          />
          <button
            onClick={handleSave}
            disabled={isSubmitting || !draft.trim()}
            className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-brand-950 bg-brand-500 hover:bg-brand-400 disabled:opacity-25 disabled:cursor-not-allowed rounded-md transition-all"
          >
            {isSubmitting
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Send className="w-3 h-3" />
            }
            Save
          </button>
        </div>
        <p className="text-[10px] text-brand-100/40 mt-1.5 ml-0.5">⌘ Enter to save</p>
      </div>

      {/* Divider */}
      <div className="border-t border-white/[0.05] mb-4 shrink-0" />

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activities === undefined ? (
          <div className="flex justify-center pt-6">
            <Loader2 className="w-5 h-5 text-brand-500/40 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center pt-8 text-center">
            <Zap className="w-6 h-6 text-brand-100/10 mb-2" />
            <p className="text-xs text-brand-100/40">No activity yet.</p>
            <p className="text-[10px] text-brand-100/15 mt-1">Notes and stage changes will appear here.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity) => (
              <ActivityRow key={activity._id} activity={activity} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
