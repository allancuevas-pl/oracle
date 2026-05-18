import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { RecordWorkspace } from '../components/layout/RecordWorkspace';
import { Loader2, Building2, ChevronDown, Plus } from 'lucide-react';
import { PropertyModal } from '../components/properties/PropertyModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { PulseFeed } from '../components/ui/PulseFeed';

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
            <CustomSelect
              value={property.status}
              onChange={(value) => updateProperty({ id: property._id, status: value })}
              options={['On Market', 'Off Market', 'Under Offer', 'Sold', 'Archived']}
              variant="status-pill"
            />
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
        <PulseFeed recordId={property._id} recordType="property" />
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
