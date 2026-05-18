import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Plus, Building, Search, Building2 } from 'lucide-react';
import { PropertyModal } from '../components/properties/PropertyModal';

const formatCurrency = (val) => {
  if (!val) return "-";
  if (val >= 1000000) {
    return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  }
  return "$" + val.toLocaleString();
};

export function Properties() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const properties = useQuery(api.properties.getProperties, {});

  return (
    <div className="p-6 lg:p-8 space-y-6 h-full flex flex-col">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <Building2 className="w-6 h-6 mr-3 text-brand-500" />
            Properties
          </h1>
          <p className="text-sm text-brand-100/50 mt-1">Manage and match commercial assets.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center justify-center shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Property
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#0A0A0A] border border-brand-800/30 rounded-xl overflow-hidden flex flex-col shadow-xl relative">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-brand-800/30 bg-[#111] flex items-center justify-between">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/30" />
            <input 
              type="text" 
              placeholder="Search address or ID..." 
              className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md pl-9 pr-3 py-1.5 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
            />
          </div>
          <div className="text-sm text-brand-100/50">
            {properties ? `${properties.length} Properties` : 'Loading...'}
          </div>
        </div>

        {/* Table View */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50 sticky top-0 border-b border-brand-800/30 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Property ID</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Address</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Asset Type</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Asking Price</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Est. Yield</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-800/20">
              {properties === undefined ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-brand-100/30">Loading inventory...</td>
                </tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-brand-100/30">
                    <Building className="w-8 h-8 mx-auto mb-3 opacity-50 text-brand-500" />
                    No properties in inventory. Click "Add Property" to start.
                  </td>
                </tr>
              ) : (
                properties.map((prop) => (
                  <tr 
                    key={prop._id} 
                    onClick={() => navigate(`/properties/${prop._id}`)}
                    className="hover:bg-brand-900/10 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-brand-500 font-mono text-xs">
                      {prop.propertyId}
                    </td>
                    <td className="px-6 py-4 text-brand-50 font-medium">
                      {prop.address}
                    </td>
                    <td className="px-6 py-4 text-brand-100/70">
                      {prop.assetType}
                    </td>
                    <td className="px-6 py-4 text-brand-50 text-right font-medium">
                      {formatCurrency(prop.askingPrice)}
                    </td>
                    <td className="px-6 py-4 text-brand-50 text-right">
                      {prop.estimatedYield ? `${prop.estimatedYield}%` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        prop.status === 'On Market' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        prop.status === 'Off Market' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        prop.status === 'Under Offer' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        prop.status === 'Sold' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-brand-800/10 text-brand-100/50 border-brand-800/20'
                      }`}>
                        {prop.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PropertyModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
