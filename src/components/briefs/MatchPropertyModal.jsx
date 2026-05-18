import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Building2, Search, Loader2 } from 'lucide-react';

const formatCurrency = (val) => {
  if (!val) return "$0";
  if (val >= 1000000) return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  return "$" + val.toLocaleString();
};

export function MatchPropertyModal({ isOpen, onClose, briefId }) {
  const [searchTerm, setSearchTerm] = useState("");
  const properties = useQuery(api.properties.getProperties);
  const createMatch = useMutation(api.matches.createMatch);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredProperties = properties?.filter(p => 
    p.address.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.propertyId && p.propertyId.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const handleMatch = async (propertyId) => {
    setIsSubmitting(true);
    try {
      await createMatch({
        briefId,
        propertyId,
        status: "Shortlisted"
      });
      onClose();
    } catch (error) {
      alert(error.message || "Failed to match property.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050505]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0A0A0A] border border-brand-800/50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-brand-800/30">
          <div>
            <h2 className="text-xl font-semibold text-brand-50">Match Property</h2>
            <p className="text-sm text-brand-100/50 mt-1">Select a property from inventory to add to this brief's pipeline.</p>
          </div>
          <button 
            onClick={onClose}
            className="text-brand-100/50 hover:text-brand-50 transition-colors p-2 rounded-md hover:bg-brand-900/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 border-b border-brand-800/30 bg-[#111]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-100/50" />
            <input 
              type="text" 
              placeholder="Search properties by address or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md pl-9 pr-4 py-2.5 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 placeholder:text-brand-100/30"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {properties === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12 text-brand-100/50 text-sm">
              No properties found matching "{searchTerm}"
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProperties.map(property => (
                <div key={property._id} className="flex items-center justify-between p-4 rounded-lg border border-brand-800/30 bg-[#111] hover:border-brand-500/30 transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-brand-500/70" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-brand-50">{property.address}</h4>
                      <p className="text-xs text-brand-100/50 mt-0.5">
                        {property.assetType} • {formatCurrency(property.askingPrice)} • {property.estimatedYield ? `${property.estimatedYield}% Yield` : 'No Yield'}
                      </p>
                    </div>
                  </div>
                  <button 
                    disabled={isSubmitting}
                    onClick={() => handleMatch(property._id)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500 hover:text-brand-950 text-brand-400 text-xs font-semibold uppercase tracking-wider rounded transition-all disabled:opacity-50"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
