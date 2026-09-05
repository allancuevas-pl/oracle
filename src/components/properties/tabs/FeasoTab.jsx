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
  { id: 'sheet',       label: 'FEASO Sheet' },
];

export function FeasoTab({ property }) {
  const [activeTab, setActiveTab] = useState('assessment');
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState(null);

  const upsertFeaso = useMutation(api.feasos.upsertFeaso);
  const linkComp    = useMutation(api.comps.linkCompToProperty);
  const updateProperty = useMutation(api.properties.updateProperty);
  const generateSheet = useAction(api.googleSheets.generateFeasoSheet);

  const feasoData   = useQuery(api.feasos.getFeasoForProperty, { propertyId: property._id });
  const linkedComps = useQuery(api.comps.getCompsByProperty,   { propertyId: property._id });

  const save = (updates) => upsertFeaso({ propertyId: property._id, ...updates });
  // The asking price lives on the property, not the feaso. Will was on this tab
  // trying to correct it and had to go to the Details tab to do it (2026-09-02).
  const saveProperty = (updates) => updateProperty({ id: property._id, ...updates });

  const sheetUrl = generatedUrl ?? property.feasoSheetUrl ?? null;
  const sheetId = sheetUrl ? (sheetUrl.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? null) : null;
  const previewUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/preview` : null;
  const runGenerate = async () => {
    setGenerating(true);
    try {
      const { url } = await generateSheet({ propertyId: property._id });
      setGeneratedUrl(url);
      toast.success(sheetUrl ? 'FEASO sheet regenerated' : 'FEASO sheet created');
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
          saveProperty={saveProperty}
        />
      )}
      {activeTab === 'sheet' && !sheetUrl && (
        <div className="flex flex-col items-center justify-center min-h-[360px] text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400/70" />
          </div>
          <p className="text-sm font-semibold text-brand-50 mb-1">FEASO Google Sheet</p>
          <p className="text-xs text-brand-100/40 leading-relaxed mb-5">
            Creates an editable Google Sheet in the team Drive, pre-filled from this property —
            subject metrics, linked comparable evidence, plus the feasibility + cashflow model.
            It stays linked here, and the team can open it in Google Drive anytime.
          </p>
          <button
            onClick={runGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2.5 rounded-md text-sm font-semibold transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {generating ? 'Creating…' : 'Create FEASO Sheet'}
          </button>
        </div>
      )}

      {activeTab === 'sheet' && sheetUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400/70" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-50">FEASO Sheet</p>
                <p className="text-[11px] text-brand-100/40">
                  Lives in the team Google Drive
                  {property.feasoSheetAt && !generatedUrl && ` · updated ${new Date(property.feasoSheetAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={sheetUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-emerald-400 bg-emerald-900/15 border border-emerald-800/40 hover:bg-emerald-900/25 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Open in Google Sheets
              </a>
              <button
                onClick={runGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-brand-100/70 bg-white/[0.03] border border-white/[0.08] hover:text-brand-100 disabled:opacity-50 transition-colors"
                title="Rebuild the sheet from the property's current data"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02]">
            <iframe
              key={sheetUrl}
              src={previewUrl}
              title="FEASO Sheet preview"
              className="w-full h-[68vh] min-h-[480px]"
            />
          </div>
          <p className="text-[11px] text-brand-100/30 text-center">
            Read-only preview. Edit in Google Sheets — you may need to be signed in to the Google account with Drive access.
          </p>
        </div>
      )}

    </div>
  );
}
