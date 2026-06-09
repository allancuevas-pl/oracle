import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { PropertyAssessmentTab } from './feaso/PropertyAssessmentTab';
import { ProjectFeasibilityTab }  from './feaso/ProjectFeasibilityTab';

const SUB_TABS = [
  { id: 'assessment',  label: 'Property Assessment' },
  { id: 'feasibility', label: 'Project Feasibility' },
  { id: 'cashflow',    label: 'Cashflow' },
];

export function FeasoTab({ property }) {
  const [activeTab, setActiveTab] = useState('assessment');

  const upsertFeaso = useMutation(api.feasos.upsertFeaso);
  const linkComp    = useMutation(api.comps.linkCompToProperty);

  const feasoData   = useQuery(api.feasos.getFeasoForProperty, { propertyId: property._id });
  const linkedComps = useQuery(api.comps.getCompsByProperty,   { propertyId: property._id });

  const save = (updates) => upsertFeaso({ propertyId: property._id, ...updates });

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
      {activeTab === 'cashflow' && (
        <div className="flex flex-col items-center justify-center min-h-[360px] text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-900/30 border border-brand-800/40 flex items-center justify-center mb-4">
            <span className="text-brand-500/50 text-lg font-mono">~</span>
          </div>
          <p className="text-sm font-semibold text-brand-50 mb-1">10-Year Cashflow</p>
          <p className="text-xs text-brand-100/35 max-w-xs leading-relaxed">
            Annual cashflow model — Gross Rent, Vacancy, NOI, Debt Service, and yield per year.
            Coming in the next phase.
          </p>
        </div>
      )}

    </div>
  );
}
