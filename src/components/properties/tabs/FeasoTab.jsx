import React, { useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Loader2, FileSpreadsheet, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PropertyAssessmentTab } from './feaso/PropertyAssessmentTab';
import { ProjectFeasibilityTab }  from './feaso/ProjectFeasibilityTab';

const SUB_TABS = [
  { id: 'assessment',  label: 'Property Assessment' },
  { id: 'feasibility', label: 'Project Feasibility' },
  { id: 'sheet',       label: 'FISO Sheet' },
];

export function FeasoTab({ property }) {
  const [activeTab, setActiveTab] = useState('assessment');
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState(null);

  const upsertFeaso = useMutation(api.feasos.upsertFeaso);
  const linkComp    = useMutation(api.comps.linkCompToProperty);
  const generateSheet = useAction(api.googleSheets.generateFisoSheet);

  const feasoData   = useQuery(api.feasos.getFeasoForProperty, { propertyId: property._id });
  const linkedComps = useQuery(api.comps.getCompsByProperty,   { propertyId: property._id });

  const save = (updates) => upsertFeaso({ propertyId: property._id, ...updates });

  const sheetUrl = generatedUrl ?? property.fisoSheetUrl ?? null;
  const runGenerate = async () => {
    setGenerating(true);
    try {
      const { url } = await generateSheet({ propertyId: property._id });
      setGeneratedUrl(url);
      toast.success('FISO sheet generated');
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err?.message || 'Could not generate the sheet.');
    } finally {
      setGenerating(false);
    }
  };

  if (feasoData === undefined || linkedComps === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[380px]">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  const feaso = feasoData ?? {};
  const leasingComps = (linkedComps || []).filter((c) => c.type === 'lease');
  const salesComps   = (linkedComps || []).filter((c) => c.type === 'sale');

  return (
    <div className="max-w-5xl space-y-0">

      {/* ── Sub-tab strip ── */}
      <div className="flex border-b border-white/[0.07] mb-6 -mx-0">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold relative transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-brand-400'
                : 'text-brand-100/35 hover:text-brand-100/60'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 inset-x-2 h-px bg-brand-500 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'assessment' && (
        <PropertyAssessmentTab
          property={property}
          leasingComps={leasingComps}
          salesComps={salesComps}
          linkComp={linkComp}
        />
      )}
      {activeTab === 'feasibility' && (
        <ProjectFeasibilityTab
          property={property}
          feaso={feaso}
          leasingComps={leasingComps}
          salesComps={salesComps}
          save={save}
        />
      )}
      {activeTab === 'sheet' && (
        <div className="flex flex-col items-center justify-center min-h-[360px] text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400/70" />
          </div>
          <p className="text-sm font-semibold text-brand-50 mb-1">FISO Google Sheet</p>
          <p className="text-xs text-brand-100/40 leading-relaxed mb-5">
            Generate an editable Google Sheet pre-filled from this property — assessment, tenancy
            schedule, linked comps, and a feasibility + 10-year cashflow model. Download or edit it
            in Google Sheets to customise the deal.
          </p>

          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer"
              className="mb-3 inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
              <ExternalLink className="w-4 h-4" /> Open FISO sheet
            </a>
          )}

          <button
            onClick={runGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : sheetUrl ? <RefreshCw className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
            {generating ? 'Generating…' : sheetUrl ? 'Regenerate sheet' : 'Generate FISO Sheet'}
          </button>

          {property.fisoSheetAt && !generatedUrl && (
            <p className="mt-3 text-[11px] text-brand-100/30">
              Last generated {new Date(property.fisoSheetAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}

    </div>
  );
}
