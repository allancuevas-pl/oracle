import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { RecordWorkspace } from '../components/layout/RecordWorkspace';
import { Loader2, Plus, Pencil, Building2, Users, MoreHorizontal, Archive, Link2, X } from 'lucide-react';
import { BriefModal } from '../components/briefs/BriefModal';
import { MatchPropertyModal } from '../components/briefs/MatchPropertyModal';
import { AssigneePicker } from '../components/briefs/AssigneePicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { IconButton, ToolbarDivider } from '../components/ui/IconButton';
import { PulseFeed } from '../components/ui/PulseFeed';
import { toast } from 'sonner';

const formatCurrency = (val) => {
  if (!val) return "$0";
  if (val >= 1000000) return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  return "$" + val.toLocaleString();
};

export function BriefView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const moreRef = useRef(null);
  const teamRef = useRef(null);

  const updateBrief = useMutation(api.briefs.updateBrief);
  const updateMatch = useMutation(api.matches.updateMatch);

  const brief = useQuery(api.briefs.getBrief, id ? { id } : "skip");
  const matches = useQuery(api.matches.getMatchesForBrief, id ? { briefId: id } : "skip");

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showMore && !showTeam) return;
    function handler(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
      if (teamRef.current && !teamRef.current.contains(e.target)) setShowTeam(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore, showTeam]);

  if (brief === undefined) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-brand-500 animate-spin" /></div>;
  }
  if (brief === null) {
    return (
      <div className="text-center mt-20">
        <p className="text-brand-100/50">Brief not found.</p>
        <button onClick={() => navigate('/briefs')} className="mt-4 text-brand-500 hover:text-brand-400 text-sm">Go Back</button>
      </div>
    );
  }

  const renderTags = (v) => {
    if (!v || v.length === 0) return <span className="text-brand-100/30 italic">Not specified</span>;
    return Array.isArray(v) ? v.join(", ") : v;
  };

  const startTime = brief.startDate ?? brief._creationTime ?? Date.now();
  const daysOpen = Math.floor((Date.now() - startTime) / (1000 * 60 * 60 * 24));
  const subtitlePrefix = brief.briefId ? `${brief.briefId} · ` : "";

  return (
    <>
      <RecordWorkspace
        title={brief.client ? brief.client.name : brief.clientName}
        subtitle={`${subtitlePrefix}${brief.client?.company ? brief.client.company + ' · ' : ''}Opened ${daysOpen} day${daysOpen !== 1 ? 's' : ''} ago`}
        onBack={() => navigate('/briefs')}
        actions={
          <>
            {/* Match Property — primary action */}
            <IconButton
              icon={Link2}
              label="Match Property"
              onClick={() => setIsMatchModalOpen(true)}
              variant="primary"
            />
            <ToolbarDivider />
            {/* Team panel */}
            <div className="relative" ref={teamRef}>
              <IconButton
                icon={Users}
                label="Team"
                onClick={() => { setShowTeam(v => !v); setShowMore(false); }}
                active={showTeam}
              />
              {showTeam && (
                <div className="absolute right-0 top-full mt-1.5 bg-[#0A0A0A]/98 border border-white/[0.08] rounded-lg p-4 shadow-2xl backdrop-blur-md z-50 w-64">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Team</span>
                    <button onClick={() => setShowTeam(false)} className="text-brand-100/30 hover:text-brand-100/70 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <AssigneePicker
                    briefId={brief._id}
                    enrichedAssignees={brief.enrichedAssignees ?? []}
                  />
                </div>
              )}
            </div>
            {/* Edit */}
            <IconButton
              icon={Pencil}
              label="Edit Brief"
              onClick={() => setIsModalOpen(true)}
            />
            {/* More */}
            <div className="relative" ref={moreRef}>
              <IconButton
                icon={MoreHorizontal}
                label="More actions"
                onClick={() => { setShowMore(v => !v); setShowTeam(false); }}
                active={showMore}
              />
              {showMore && (
                <div className="absolute right-0 top-full mt-1.5 bg-[#0A0A0A]/98 border border-white/[0.08] rounded-lg p-1 shadow-2xl backdrop-blur-md z-50 min-w-[160px]">
                  <button
                    onClick={() => { setShowMore(false); toast.info("Archive coming soon"); }}
                    className="w-full flex items-center px-3 py-2 text-xs text-brand-100/60 hover:bg-white/[0.05] hover:text-white rounded-md transition-colors gap-2.5"
                  >
                    <Archive className="w-3.5 h-3.5 text-brand-100/30" />
                    Archive Brief
                  </button>
                </div>
              )}
            </div>
          </>
        }
        leftColumn={
          <div className="space-y-6">

            {/* Client link */}
            {brief.client && (
              <div
                onClick={() => navigate(`/clients/${brief.client._id}`)}
                className="flex items-center space-x-3 p-3 rounded-lg border border-brand-500/20 bg-brand-500/5 hover:bg-brand-500/10 cursor-pointer transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-brand-400">{brief.client.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-brand-100/40 mb-0.5 flex items-center gap-1 uppercase tracking-wider">
                    <Users className="w-2.5 h-2.5" /> Client
                  </p>
                  <p className="text-sm font-medium text-brand-400 group-hover:text-brand-300 truncate">{brief.client.name}</p>
                  {brief.client.company && <p className="text-xs text-brand-100/40 truncate">{brief.client.company}</p>}
                </div>
              </div>
            )}

            {/* Inline status — Stage + Priority live here, not in the header */}
            <div className="space-y-3 pb-5 border-b border-white/[0.04]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Status</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-brand-100/40 mb-1.5 uppercase tracking-wider">Stage</p>
                  <CustomSelect
                    value={brief.stage}
                    onChange={(value) => updateBrief({ id: brief._id, stage: value })}
                    options={['Triage', 'Active Search', 'Offer Submitted', 'Due Diligence']}
                    variant="pill"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-brand-100/40 mb-1.5 uppercase tracking-wider">Priority</p>
                  <CustomSelect
                    value={brief.priority || 'Low'}
                    onChange={(value) => updateBrief({ id: brief._id, priority: value })}
                    options={['High', 'Medium', 'Low']}
                    variant="priority"
                  />
                </div>
              </div>
            </div>

            {/* Brief Criteria */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Brief Criteria</h2>

              <div>
                <p className="text-xs text-brand-100/50 mb-1">Budget Range</p>
                <p className="text-sm text-brand-50 font-medium">
                  {brief.budgetMin && brief.budgetMax
                    ? `${formatCurrency(brief.budgetMin)} – ${formatCurrency(brief.budgetMax)}`
                    : (brief.budget || <span className="text-brand-100/30 italic">Not specified</span>)}
                </p>
              </div>

              <div>
                <p className="text-xs text-brand-100/50 mb-1">Target Duration</p>
                <p className="text-sm text-brand-50 font-medium">
                  {brief.durationMin && brief.durationMax
                    ? `${brief.durationMin} to ${brief.durationMax} years`
                    : <span className="text-brand-100/30 italic">Not specified</span>}
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
                <p className="text-sm text-brand-50 font-medium">{renderTags(brief.assetTypes || brief.assetType)}</p>
              </div>

              <div>
                <p className="text-xs text-brand-100/50 mb-1">Target Locations</p>
                <p className="text-sm text-brand-50 font-medium">{renderTags(brief.location)}</p>
              </div>

              <div>
                <p className="text-xs text-brand-100/50 mb-1">Strategies</p>
                <p className="text-sm text-brand-50 font-medium leading-relaxed">{renderTags(brief.strategies || brief.requirements)}</p>
              </div>

              <div className="pt-4 border-t border-brand-800/20">
                <p className="text-xs text-brand-100/50 mb-1">Debt Structure</p>
                <p className="text-sm text-brand-50 font-medium">{renderTags(brief.debtStructure)}</p>
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
              <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Pipeline (Matched Properties)</h2>
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
                  <Link2 className="w-5 h-5 text-brand-500/50" />
                </div>
                <h3 className="text-brand-50 font-medium mb-1">No properties matched</h3>
                <p className="text-sm text-brand-100/50 max-w-sm">
                  Use the link icon in the toolbar to start evaluating commercial assets against this brief.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <div
                    key={match._id}
                    onClick={() => navigate(`/properties/${match.property?._id}`)}
                    className="border border-brand-800/50 rounded-lg bg-[#111] overflow-hidden transition-all hover:border-brand-500/30 cursor-pointer group"
                  >
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded bg-brand-900/30 flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-800/50">
                          <Building2 className="w-5 h-5 text-brand-500/70" />
                        </div>
                        <div>
                          <h4 className="text-brand-50 font-medium group-hover:text-brand-400 transition-colors">
                            {match.property?.address}
                          </h4>
                          <p className="text-xs text-brand-100/50 mt-1">
                            {match.property?.assetType} · {formatCurrency(match.property?.askingPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
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
        rightColumn={<PulseFeed recordId={brief._id} recordType="brief" />}
      />
      <BriefModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} editingBrief={brief} />
      <MatchPropertyModal isOpen={isMatchModalOpen} onClose={() => setIsMatchModalOpen(false)} briefId={brief._id} />
    </>
  );
}
