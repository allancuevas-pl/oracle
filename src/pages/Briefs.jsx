import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Plus, X, Loader2, ArrowUpDown } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

import { useNavigate } from 'react-router-dom';
import { BriefModal } from '../components/briefs/BriefModal';

// Helper to format numbers to currency ($X.XM or $X,XXX)
const formatCurrency = (val) => {
  if (!val) return "$0";
  if (val >= 1000000) {
    return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  }
  return "$" + val.toLocaleString();
};

export function Briefs() {
  const navigate = useNavigate();
  const briefs = useQuery(api.briefs.getBriefs, { status: "active" });
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const openNewModal = () => {
    setIsModalOpen(true);
  };

  const renderTags = (tagsStringOrArray) => {
    if (!tagsStringOrArray) return '-';
    if (Array.isArray(tagsStringOrArray)) return tagsStringOrArray.join(", ");
    return tagsStringOrArray;
  };

  // Sorting Logic
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getSortedBriefs = () => {
    if (!briefs) return [];
    if (!sortField) return briefs;
    
    return [...briefs].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'clientName':
          aVal = (a.clientName || '').toLowerCase();
          bVal = (b.clientName || '').toLowerCase();
          break;
        case 'priority':
          const pMap = { "High": 3, "Medium": 2, "Low": 1 };
          aVal = pMap[a.priority] || 0;
          bVal = pMap[b.priority] || 0;
          break;
        case 'stage':
          aVal = (a.stage || '').toLowerCase();
          bVal = (b.stage || '').toLowerCase();
          break;
        case 'daysOpen':
          // Sort by creation time. Smaller timestamp = older = more days open.
          aVal = a._creationTime || 0;
          bVal = b._creationTime || 0;
          break;
        case 'assetType':
          aVal = a.assetTypes && a.assetTypes.length > 0 ? a.assetTypes[0].toLowerCase() : (a.assetType || '').toLowerCase();
          bVal = b.assetTypes && b.assetTypes.length > 0 ? b.assetTypes[0].toLowerCase() : (b.assetType || '').toLowerCase();
          break;
        case 'budget':
          aVal = a.budgetMin || 0;
          bVal = b.budgetMin || 0;
          break;
        case 'location':
          aVal = a.location && a.location.length > 0 ? a.location[0].toLowerCase() : '';
          bVal = b.location && b.location.length > 0 ? b.location[0].toLowerCase() : '';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedBriefs = getSortedBriefs();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Client Briefs</h1>
          <p className="text-brand-100/60 text-sm mt-1">Manage all active client purchasing requirements.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center shadow-[0_0_15px_rgba(212,175,55,0.15)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Brief
        </button>
      </div>

      <div className="bg-[#111] border border-brand-800/40 rounded-lg overflow-hidden">
        {briefs === undefined ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : briefs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-brand-100/50">No active briefs found. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-brand-100/50 bg-[#0A0A0A]/50 uppercase border-b border-brand-800/40">
                <tr>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group w-20 text-center"
                    onClick={() => handleSort('priority')}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <span>Priority</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'priority' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('clientName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Client</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'clientName' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('stage')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Stage</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'stage' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('daysOpen')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Days Open</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'daysOpen' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('assetType')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Asset Types</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'assetType' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('budget')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Budget Range</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'budget' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium whitespace-nowrap cursor-pointer hover:text-white transition-colors group"
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Location</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortField === 'location' ? 'text-brand-500' : 'text-brand-100/30 group-hover:text-brand-100/70'}`} />
                    </div>
                  </th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Strategies</th>
                </tr>
              </thead>
              <tbody>
                {sortedBriefs.map((brief) => {
                  const daysOpen = Math.floor((Date.now() - (brief._creationTime || Date.now())) / (1000 * 60 * 60 * 24));
                  
                  return (
                  <tr 
                    key={brief._id} 
                    onClick={() => navigate('/briefs/' + brief._id)}
                    className="border-b border-brand-800/20 hover:bg-brand-900/10 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4 w-20">
                      <div className="flex items-center justify-center">
                        {brief.priority === 'High' && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="High Priority"></div>}
                        {brief.priority === 'Medium' && <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" title="Medium Priority"></div>}
                        {(brief.priority === 'Low' || !brief.priority) && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" title="Low Priority"></div>}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-brand-50 whitespace-nowrap">
                      {brief.clientName}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {brief.stage}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-brand-100/70">
                      {daysOpen} {daysOpen === 1 ? 'day' : 'days'}
                    </td>
                    <td className="px-4 py-4 text-brand-100/70 truncate max-w-[150px]">
                      {renderTags(brief.assetTypes || brief.assetType)}
                    </td>
                    <td className="px-4 py-4 text-brand-100/70 whitespace-nowrap">
                      {brief.budgetMin && brief.budgetMax ? `${formatCurrency(brief.budgetMin)} - ${formatCurrency(brief.budgetMax)}` : (brief.budget || brief.estimatedValue)}
                    </td>
                    <td className="px-4 py-4 text-brand-100/70 truncate max-w-[100px]">
                      {renderTags(brief.location)}
                    </td>
                    <td className="px-4 py-4 text-brand-100/50 truncate max-w-[200px]">
                      {renderTags(brief.strategies || brief.requirements)}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BriefModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingBrief={null}
      />
    </div>
  );
}
