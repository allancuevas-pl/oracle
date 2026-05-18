import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { RecordWorkspace } from '../components/layout/RecordWorkspace';
import { Loader2, Building2, ChevronDown, Plus } from 'lucide-react';
import { PropertyModal } from '../components/properties/PropertyModal';

const formatCurrency = (val) => {
  if (!val) return "$0";
  if (val >= 1000000) {
    return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  }
  return "$" + val.toLocaleString();
};

export function PropertyView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const updateProperty = useMutation(api.properties.updateProperty);
  
  const property = useQuery(api.properties.getProperty, id ? { id } : "skip");

  if (property === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (property === null) {
    return (
      <div className="text-center mt-20">
        <p className="text-brand-100/50">Property not found.</p>
        <button onClick={() => navigate('/properties')} className="mt-4 text-brand-500 hover:text-brand-400">Go Back</button>
      </div>
    );
  }

  const daysOpen = Math.floor((Date.now() - (property._creationTime || Date.now())) / (1000 * 60 * 60 * 24));
  const subtitlePrefix = property.propertyId ? `${property.propertyId} • ` : "";

  return (
    <>
      <RecordWorkspace
        title={property.address}
        subtitle={`${subtitlePrefix}Added ${daysOpen} days ago`}
        statusControls={
          <div className="flex items-center space-x-2">
            {/* Status Dropdown */}
            <div className="relative group cursor-pointer">
              <select 
                value={property.status}
                onChange={(e) => updateProperty({ id: property._id, status: e.target.value })}
                className={`appearance-none pl-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none cursor-pointer border ${
                  property.status === 'On Market' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  property.status === 'Off Market' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                  property.status === 'Under Offer' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                  property.status === 'Sold' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-brand-800/10 text-brand-100/50 border-brand-800/20'
                }`}
              >
                <option value="On Market">On Market</option>
                <option value="Off Market">Off Market</option>
                <option value="Under Offer">Under Offer</option>
                <option value="Sold">Sold</option>
                <option value="Archived">Archived</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <ChevronDown className="w-3 h-3" />
              </div>
            </div>
          </div>
        }
        onBack={() => navigate('/properties')}
        actions={
          <>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 border border-brand-800/50 hover:bg-brand-900/30 text-brand-100 rounded-md text-sm font-medium transition-colors"
            >
              Edit
            </button>
          </>
        }
      leftColumn={
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Property Details</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-xs text-brand-100/50 mb-1">Asset Type</p>
              <p className="text-sm text-brand-50 font-medium">{property.assetType || <span className="text-brand-100/30 italic">Not specified</span>}</p>
            </div>
            
            <div>
              <p className="text-xs text-brand-100/50 mb-1">Location</p>
              <p className="text-sm text-brand-50 font-medium">{property.location || <span className="text-brand-100/30 italic">Not specified</span>}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-brand-800/20">
              <div>
                <p className="text-xs text-brand-100/50 mb-1">Land Area</p>
                <p className="text-sm text-brand-50 font-medium">
                  {property.landArea ? `${property.landArea.toLocaleString()} sqm` : <span className="text-brand-100/30 italic">Not specified</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-brand-100/50 mb-1">Building Area</p>
                <p className="text-sm text-brand-50 font-medium">
                  {property.buildingArea ? `${property.buildingArea.toLocaleString()} sqm` : <span className="text-brand-100/30 italic">Not specified</span>}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-800/20">
              <p className="text-xs text-brand-100/50 mb-1">Description</p>
              <p className="text-sm text-brand-100/70 whitespace-pre-wrap">
                {property.description || <span className="text-brand-100/30 italic">No description provided.</span>}
              </p>
            </div>
          </div>
        </div>
      }
      centerColumn={
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Financials</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[#111] border border-brand-800/30">
              <p className="text-xs text-brand-100/50 mb-1 uppercase tracking-wider">Asking Price</p>
              <p className="text-xl text-brand-50 font-semibold">{formatCurrency(property.askingPrice)}</p>
            </div>
            <div className="p-4 rounded-lg bg-[#111] border border-brand-800/30">
              <p className="text-xs text-brand-100/50 mb-1 uppercase tracking-wider">Est. Yield</p>
              <p className="text-xl text-brand-50 font-semibold">{property.estimatedYield ? `${property.estimatedYield}%` : '-'}</p>
            </div>
            <div className="p-4 rounded-lg bg-[#111] border border-brand-800/30">
              <p className="text-xs text-brand-100/50 mb-1 uppercase tracking-wider">W.A.L.E.S</p>
              <p className="text-xl text-brand-50 font-semibold">{property.wales ? `${property.wales} yrs` : '-'}</p>
            </div>
          </div>
        </div>
      }
      rightColumn={
        <div className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Activity & Pulse</h2>
          
          <div className="relative pl-4 border-l border-brand-800/30 space-y-6">
            <div className="relative">
              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-brand-500 border border-[#0A0A0A]"></div>
              <p className="text-sm text-brand-50">Property Added</p>
              <p className="text-xs text-brand-100/50 mt-0.5">By {property.createdBy || 'Unknown'} • {new Date(property._creationTime).toLocaleDateString()}</p>
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
      <PropertyModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProperty={property}
      />
    </>
  );
}
