import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { RecordWorkspace } from '../components/layout/RecordWorkspace';
import { Loader2, Plus, ChevronDown } from 'lucide-react';
import { BriefModal } from '../components/briefs/BriefModal';
import { MatchPropertyModal } from '../components/briefs/MatchPropertyModal';
import { Building2 } from 'lucide-react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { PulseFeed } from '../components/ui/PulseFeed';

const formatCurrency = (val) => {
  if (!val) return "$0";
  if (val >= 1000000) {
    return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  }
  return "$" + val.toLocaleString();
};

export function BriefView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const updateBrief = useMutation(api.briefs.updateBrief);
  const updateMatch = useMutation(api.matches.updateMatch);
  
  // Need to ensure id is valid, Convex useQuery will throw if id is structurally invalid for v.id("briefs")
  const brief = useQuery(api.briefs.getBrief, id ? { id } : "skip");
  const matches = useQuery(api.matches.getMatchesForBrief, id ? { briefId: id } : "skip");

  if (brief === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (brief === null) {
    return (
      <div className="text-center mt-20">
        <p className="text-brand-100/50">Brief not found.</p>
        <button onClick={() => navigate('/briefs')} className="mt-4 text-brand-500 hover:text-brand-400">Go Back</button>
      </div>
    );
  }

  const renderTags = (tagsStringOrArray) => {
    if (!tagsStringOrArray || tagsStringOrArray.length === 0) return <span className="text-brand-100/30 italic">Not specified</span>;
    if (Array.isArray(tagsStringOrArray)) return tagsStringOrArray.join(", ");
    return tagsStringOrArray;
  };

  const daysOpen = Math.floor((Date.now() - (brief._creationTime || Date.now())) / (1000 * 60 * 60 * 24));
  const subtitlePrefix = brief.briefId ? `${brief.briefId} • ` : "";

  return (
    <>
      <RecordWorkspace
        title={brief.clientName}
        subtitle={`${subtitlePrefix}Opened ${daysOpen} days ago`}
        statusControls={
          <div className="flex items-center space-x-2">
            <CustomSelect
              value={brief.priority || 'Low'}
              onChange={(value) => updateBrief({ id: brief._id, priority: value })}
              options={['High', 'Medium', 'Low']}
              variant="priority"
              className="w-32"
            />
            <CustomSelect
              value={brief.stage}
              onChange={(value) => updateBrief({ id: brief._id, stage: value })}
              options={['Triage', 'Active Search', 'Offer Submitted', 'Due Diligence']}
              variant="pill"
            />
          </div>
        }
        onBack={() => navigate('/briefs')}
        actions={
          <>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 border border-brand-800/50 hover:bg-brand-900/30 text-brand-100 rounded-md text-sm font-medium transition-colors"
            >
              Edit
            </button>
            <button 
              onClick={() => setIsMatchModalOpen(true)}
              className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2 rounded-md text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Match Property
            </button>
          </>
        }
      leftColumn={
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Brief Criteria</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-brand-100/50 mb-1">Budget Range</p>
              <p className="text-sm text-brand-50 font-medium">
                {brief.budgetMin && brief.budgetMax ? `${formatCurrency(brief.budgetMin)} - ${formatCurrency(brief.budgetMax)}` : (brief.budget || <span className="text-brand-100/30 italic">Not specified</span>)}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-brand-100/50 mb-1">Target Duration</p>
              <p className="text-sm text-brand-50 font-medium">
                {brief.durationMin && brief.durationMax ? `${brief.durationMin} to ${brief.durationMax} years` : <span className="text-brand-100/30 italic">Not specified</span>}
              </p>
            </div>

            <div>
              <p className="text-xs text-brand-100/50 mb-1">Available Capital</p>
              <p className="text-sm text-brand-50 font-medium">
                {brief.capital ? formatCurrency(brief.capital) : <span className="text-brand-100/30 italic">Not specified</span>}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-brand-100/50 mb-1">Asset Types</p>
              <p className="text-sm text-brand-50 font-medium">
                {renderTags(brief.assetTypes || brief.assetType)}
              </p>
            </div>

            <div>
              <p className="text-xs text-brand-100/50 mb-1">Target Locations</p>
              <p className="text-sm text-brand-50 font-medium">
                {renderTags(brief.location)}
              </p>
            </div>

            <div>
              <p className="text-xs text-brand-100/50 mb-1">Strategies</p>
              <p className="text-sm text-brand-50 font-medium leading-relaxed">
                {renderTags(brief.strategies || brief.requirements)}
              </p>
            </div>
            
            <div className="pt-4 border-t border-brand-800/20">
              <p className="text-xs text-brand-100/50 mb-1">Debt Structure</p>
              <p className="text-sm text-brand-50 font-medium">
                {renderTags(brief.debtStructure)}
              </p>
            </div>

            <div>
              <p className="text-xs text-brand-100/50 mb-1">Financial Targets</p>
              <p className="text-sm text-brand-50 font-medium">
                {brief.targets || <span className="text-brand-100/30 italic">Not specified</span>}
              </p>
            </div>

            <div className="pt-4 border-t border-brand-800/20">
              <p className="text-xs text-brand-100/50 mb-1">Additional Notes</p>
              <p className="text-sm text-brand-100/70 whitespace-pre-wrap">
                {brief.others || <span className="text-brand-100/30 italic">No additional notes provided.</span>}
              </p>
            </div>
          </div>
        </div>
      }
      centerColumn={
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Pipeline (Matched Properties)</h2>
            <span className="px-2 py-0.5 rounded-full bg-brand-900/30 text-brand-400 text-xs font-bold border border-brand-800/50">
              {matches?.length || 0} MATCHES
            </span>
          </div>
          
          {matches === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <div className="border border-brand-800/30 rounded-lg bg-[#111] p-12 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-brand-900/30 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-brand-500/50" />
              </div>
              <h3 className="text-brand-50 font-medium mb-1">No properties matched</h3>
              <p className="text-sm text-brand-100/50 max-w-sm">
                Click "Match Property" to start evaluating commercial assets against this brief.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => (
                <div key={match._id} className="border border-brand-800/50 rounded-lg bg-[#111] overflow-hidden transition-all hover:border-brand-500/30">
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded bg-brand-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-800/50">
                        <Building2 className="w-5 h-5 text-brand-500/70" />
                      </div>
                      <div>
                        <h4 className="text-brand-50 font-medium cursor-pointer hover:text-brand-400 transition-colors" onClick={() => navigate('/properties')}>
                          {match.property?.address}
                        </h4>
                        <p className="text-xs text-brand-100/50 mt-1">
                          {match.property?.assetType} • {formatCurrency(match.property?.askingPrice)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status Select for Match */}
                    <div className="relative">
                      <CustomSelect
                        value={match.status}
                        onChange={(value) => updateMatch({ id: match._id, status: value })}
                        options={['Shortlisted', 'Under Review', 'Offered', 'Accepted', 'Rejected']}
                        variant="pill"
                        className="w-32"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      }
      rightColumn={
        <PulseFeed recordId={brief._id} recordType="brief" />
      }
      />
      <BriefModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingBrief={brief}
      />
      <MatchPropertyModal 
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        briefId={brief._id}
      />
    </>
  );
}
