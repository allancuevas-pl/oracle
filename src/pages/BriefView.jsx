import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { RecordWorkspace } from '../components/layout/RecordWorkspace';
import { Loader2, Plus, ChevronDown } from 'lucide-react';
import { BriefModal } from '../components/briefs/BriefModal';

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
  const updateBrief = useMutation(api.briefs.updateBrief);
  
  // Need to ensure id is valid, Convex useQuery will throw if id is structurally invalid for v.id("briefs")
  const brief = useQuery(api.briefs.getBrief, id ? { id } : "skip");

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
    if (!tagsStringOrArray) return '-';
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
            {/* Priority Dropdown */}
            <div className="relative group cursor-pointer">
              <select 
                value={brief.priority || 'Low'}
                onChange={(e) => updateBrief({ id: brief._id, priority: e.target.value })}
                className="appearance-none pl-6 pr-6 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none cursor-pointer bg-[#111] border border-brand-800/50 hover:border-brand-500/50 text-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                {brief.priority === 'High' && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>}
                {brief.priority === 'Medium' && <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"></div>}
                {(brief.priority === 'Low' || !brief.priority) && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>}
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-100/50">
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>

            {/* Stage Dropdown */}
            <div className="relative group cursor-pointer">
              <select 
                value={brief.stage}
                onChange={(e) => updateBrief({ id: brief._id, stage: e.target.value })}
                className="appearance-none px-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none cursor-pointer bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20"
              >
                <option value="Triage">Triage</option>
                <option value="Active Search">Active Search</option>
                <option value="Offer Submitted">Offer Submitted</option>
                <option value="Due Diligence">Due Diligence</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-400">
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>
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
            <button className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center">
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
                {brief.budgetMin && brief.budgetMax ? `${formatCurrency(brief.budgetMin)} - ${formatCurrency(brief.budgetMax)}` : (brief.budget || '-')}
              </p>
            </div>
            
            <div>
              <p className="text-xs text-brand-100/50 mb-1">Target Duration</p>
              <p className="text-sm text-brand-50 font-medium">
                {brief.durationMin && brief.durationMax ? `${brief.durationMin} to ${brief.durationMax} years` : '-'}
              </p>
            </div>

            <div>
              <p className="text-xs text-brand-100/50 mb-1">Available Capital</p>
              <p className="text-sm text-brand-50 font-medium">
                {brief.capital ? formatCurrency(brief.capital) : '-'}
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
                {brief.targets || '-'}
              </p>
            </div>

            <div className="pt-4 border-t border-brand-800/20">
              <p className="text-xs text-brand-100/50 mb-1">Additional Notes</p>
              <p className="text-sm text-brand-100/70 whitespace-pre-wrap">
                {brief.others || 'No additional notes provided.'}
              </p>
            </div>
          </div>
        </div>
      }
      centerColumn={
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Pipeline (Matched Properties)</h2>
          
          <div className="border border-brand-800/30 rounded-lg bg-[#111] p-12 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-brand-900/30 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-brand-500/50" />
            </div>
            <h3 className="text-brand-50 font-medium mb-1">No properties matched</h3>
            <p className="text-sm text-brand-100/50 max-w-sm">
              Click "Match Property" to start evaluating commercial assets against this brief.
            </p>
          </div>
        </div>
      }
      rightColumn={
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Activity & Pulse</h2>
          
          <div className="relative pl-4 border-l border-brand-800/30 space-y-6">
            <div className="relative">
              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-500 border border-[#0A0A0A]"></div>
              <p className="text-sm text-brand-50">Brief Created</p>
              <p className="text-xs text-brand-100/50 mt-0.5">By {brief.createdBy || 'Unknown'} • {new Date(brief._creationTime).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-brand-800/20">
            <textarea 
              className="w-full bg-[#111] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 placeholder:text-brand-100/30" 
              placeholder="Leave a private note..."
              rows={3}
            ></textarea>
            <div className="flex justify-end mt-2">
              <button className="px-3 py-1.5 bg-brand-900/30 text-brand-400 hover:bg-brand-900/50 text-xs font-medium rounded transition-colors">
                Save Note
              </button>
            </div>
          </div>
        </div>
      }
      />
      <BriefModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingBrief={brief}
      />
    </>
  );
}
