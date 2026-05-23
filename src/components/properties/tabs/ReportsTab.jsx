import React from 'react';
import { FileText, FileBarChart2, Scroll, ArrowRight } from 'lucide-react';

const REPORT_TYPES = [
  {
    icon: FileText,
    title: 'Investment Memorandum',
    description: 'Auto-generate a professional IM with property details, financials, and tenancy overview.',
  },
  {
    icon: Scroll,
    title: 'Heads of Terms',
    description: 'Draft a Heads of Terms document for offer submissions or lease negotiations.',
  },
  {
    icon: FileBarChart2,
    title: 'Rent Roll Report',
    description: 'Export a formatted rent roll PDF from your tenancy schedule data.',
  },
];

export function ReportsTab() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-3">Reports</p>
        <h3 className="text-lg font-semibold text-brand-50 mb-2">Document Generation</h3>
        <p className="text-sm text-brand-100/40 max-w-md mx-auto">
          Generate professional reports and documents directly from property data.
          Available in a future release.
        </p>
      </div>

      <div className="space-y-3">
        {REPORT_TYPES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.05] bg-white/[0.01] opacity-60"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-900/30 border border-brand-800/30 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-brand-500/50" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-100/70">{title}</p>
              <p className="text-xs text-brand-100/35 mt-0.5 leading-relaxed">{description}</p>
            </div>
            <div className="shrink-0 ml-auto">
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-brand-100/30">
                Coming soon
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <div className="flex items-center gap-2 text-xs text-brand-100/25">
          <span className="px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">Phase 3</span>
          <ArrowRight className="w-3.5 h-3.5" />
          <span>Document generation engine</span>
        </div>
      </div>
    </div>
  );
}
