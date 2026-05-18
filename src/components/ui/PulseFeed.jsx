import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function PulseFeed({ recordId, recordType }) {
  const activities = useQuery(api.activities.getActivities, recordId ? { recordId } : "skip");
  const addNote = useMutation(api.activities.addNote);
  
  const [noteContent, setNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addNote({
        recordId,
        recordType,
        content: noteContent.trim(),
      });
      setNoteContent('');
      toast.success("Note saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save note");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500 mb-6 shrink-0">Activity & Pulse</h2>
      
      {/* Activity Timeline (Scrollable) */}
      <div className="flex-1 overflow-y-auto mb-6 pr-2">
        {activities === undefined ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-brand-100/30 italic">No activity yet.</p>
        ) : (
          <div className="relative pl-4 border-l border-white/5 space-y-6">
            {activities.map((activity) => (
              <div key={activity._id} className="relative">
                {activity.type === 'note' ? (
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border border-[#0A0A0A] shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                ) : (
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-500 border border-[#0A0A0A] shadow-[0_0_8px_rgba(212,175,55,0.6)]"></div>
                )}
                
                <p className={`text-sm ${activity.type === 'note' ? 'text-blue-100' : 'text-brand-50'} whitespace-pre-wrap`}>
                  {activity.content}
                </p>
                <p className="text-xs text-brand-100/50 mt-1">
                  {new Date(activity._creationTime).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Note Input (Fixed at bottom) */}
      <div className="pt-4 border-t border-white/5 shrink-0">
        <textarea 
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          className="w-full bg-[#111] border border-white/5 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 placeholder:text-brand-100/30 shadow-inner" 
          placeholder="Leave a private note..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSaveNote();
            }
          }}
        ></textarea>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] text-brand-100/30">Cmd/Ctrl + Enter to save</span>
          <button 
            onClick={handleSaveNote}
            disabled={isSubmitting || !noteContent.trim()}
            className="px-4 py-1.5 bg-brand-900/30 text-brand-400 hover:bg-brand-900/50 disabled:opacity-50 text-xs font-medium rounded transition-colors flex items-center"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
