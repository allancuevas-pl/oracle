import React from 'react';
import { Paperclip, Upload, ArrowRight } from 'lucide-react';

export function FilesTab() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Dropzone (stubbed) */}
      <div className="rounded-xl border-2 border-dashed border-white/[0.08] bg-white/[0.01] p-12 text-center mb-6 hover:border-brand-500/20 hover:bg-brand-500/[0.02] transition-colors cursor-not-allowed">
        <Upload className="w-8 h-8 text-brand-100/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-brand-100/40 mb-1">Drop files here to attach</p>
        <p className="text-xs text-brand-100/40">
          PDF, DOCX, XLSX, images up to 25MB each
        </p>
        <span className="inline-block mt-4 text-[10px] px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-brand-100/45">
          Coming soon
        </span>
      </div>

      {/* Empty file list */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="bg-[#0A0A0A] px-5 py-3 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
            Attached Files
          </p>
        </div>
        <div className="py-14 text-center">
          <Paperclip className="w-7 h-7 text-brand-100/40 mx-auto mb-3" />
          <p className="text-sm text-brand-100/40">No files attached</p>
          <p className="text-xs text-brand-100/40 mt-1">
            Due diligence materials, reports, and correspondence will appear here.
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="flex items-center gap-2 text-xs text-brand-100/40">
          <span className="px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">Phase 3</span>
          <ArrowRight className="w-3.5 h-3.5" />
          <span>File storage integration</span>
        </div>
      </div>
    </div>
  );
}
