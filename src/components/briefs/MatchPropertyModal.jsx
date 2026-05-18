import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Building2, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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

  // Removed early return for AnimatePresence to work

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
      toast.success("Property matched successfully", {
        description: "It has been added to the brief's pipeline."
      });
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to match property.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-10 overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-xl font-semibold text-brand-50 tracking-tight">Match Property</h2>
                <p className="text-sm text-brand-100/50 mt-1">Select a property from inventory to add to this brief's pipeline.</p>
              </div>
              <button 
                onClick={onClose}
                className="text-brand-100/50 hover:text-brand-50 transition-colors p-2 rounded-md hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-100/50" />
                <input 
                  type="text" 
                  placeholder="Search properties by address or ID..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-md pl-9 pr-4 py-2.5 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 placeholder:text-brand-100/30 shadow-inner"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-6 flex-1 bg-[#0A0A0A]">
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
                  {filteredProperties.map((property, index) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={property._id} 
                      className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-brand-500/30 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                          <Building2 className="w-5 h-5 text-brand-500/70" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-brand-50 group-hover:text-brand-400 transition-colors">{property.address}</h4>
                          <p className="text-xs text-brand-100/50 mt-0.5">
                            {property.assetType} • {formatCurrency(property.askingPrice)} • {property.estimatedYield ? `${property.estimatedYield}% Yield` : 'No Yield'}
                          </p>
                        </div>
                      </div>
                      <button 
                        disabled={isSubmitting}
                        onClick={() => handleMatch(property._id)}
                        className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-white/5 hover:bg-brand-500 hover:text-brand-950 text-brand-400 text-xs font-semibold uppercase tracking-wider rounded-md transition-all disabled:opacity-50 border border-white/5 hover:border-transparent"
                      >
                        Select
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
