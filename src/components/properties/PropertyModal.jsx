import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Building } from 'lucide-react';

export function PropertyModal({ isOpen, onClose, editingProperty }) {
  const createProperty = useMutation(api.properties.createProperty);
  const updateProperty = useMutation(api.properties.updateProperty);
  const settings = useQuery(api.settings.getSettings);

  const [formData, setFormData] = useState({
    address: '',
    assetType: 'Retail',
    status: 'Off Market',
    askingPrice: '',
    estimatedYield: '',
    location: '',
    landArea: '',
    buildingArea: '',
    wales: '',
    description: '',
  });

  useEffect(() => {
    if (editingProperty) {
      setFormData({
        address: editingProperty.address || '',
        assetType: editingProperty.assetType || 'Retail',
        status: editingProperty.status || 'Off Market',
        askingPrice: editingProperty.askingPrice || '',
        estimatedYield: editingProperty.estimatedYield || '',
        location: editingProperty.location || '',
        landArea: editingProperty.landArea || '',
        buildingArea: editingProperty.buildingArea || '',
        wales: editingProperty.wales || '',
        description: editingProperty.description || '',
      });
    } else {
      setFormData({
        address: '',
        assetType: 'Retail',
        status: 'Off Market',
        askingPrice: '',
        estimatedYield: '',
        location: '',
        landArea: '',
        buildingArea: '',
        wales: '',
        description: '',
      });
    }
  }, [editingProperty, isOpen]);

  if (!isOpen || !settings) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      askingPrice: formData.askingPrice ? Number(formData.askingPrice) : undefined,
      estimatedYield: formData.estimatedYield ? Number(formData.estimatedYield) : undefined,
      landArea: formData.landArea ? Number(formData.landArea) : undefined,
      buildingArea: formData.buildingArea ? Number(formData.buildingArea) : undefined,
      wales: formData.wales ? Number(formData.wales) : undefined,
    };

    try {
      if (editingProperty) {
        await updateProperty({ id: editingProperty._id, ...payload });
      } else {
        await createProperty(payload);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save property", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0A0A0A] border border-brand-800/30 w-full max-w-2xl rounded-xl shadow-2xl relative my-8 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex-none flex items-center justify-between p-6 border-b border-brand-800/30">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Building className="w-5 h-5 mr-2 text-brand-500" />
              {editingProperty ? 'Edit Property Asset' : 'Add New Property'}
            </h2>
            <p className="text-sm text-brand-100/50 mt-1">Enter the asset details to match against active briefs.</p>
          </div>
          <button onClick={onClose} className="p-2 text-brand-100/50 hover:text-white hover:bg-brand-800/30 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="property-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Address</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="123 Example Street, City, State"
                className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Classification Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Asset Type</label>
                <select
                  value={formData.assetType}
                  onChange={e => setFormData({...formData, assetType: e.target.value})}
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                >
                  {settings.assetTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                >
                  <option value="Off Market">Off Market</option>
                  <option value="On Market">On Market</option>
                  <option value="Under Offer">Under Offer</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>
            </div>

            {/* Financials Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Asking Price ($)</label>
                <input
                  type="number"
                  value={formData.askingPrice}
                  onChange={e => setFormData({...formData, askingPrice: e.target.value})}
                  placeholder="e.g. 5000000"
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Est. Yield (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.estimatedYield}
                  onChange={e => setFormData({...formData, estimatedYield: e.target.value})}
                  placeholder="e.g. 5.5"
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Land Area (sqm)</label>
                <input
                  type="number"
                  value={formData.landArea}
                  onChange={e => setFormData({...formData, landArea: e.target.value})}
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Bldg Area (sqm)</label>
                <input
                  type="number"
                  value={formData.buildingArea}
                  onChange={e => setFormData({...formData, buildingArea: e.target.value})}
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">WALE (Years)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.wales}
                  onChange={e => setFormData({...formData, wales: e.target.value})}
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Private Notes / Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                rows={4}
                className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex-none p-6 border-t border-brand-800/30 flex justify-end space-x-3 bg-[#0A0A0A] rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-brand-100/70 hover:text-white hover:bg-brand-800/30 rounded-md transition-colors border border-transparent"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="property-form"
            className="px-6 py-2 text-sm font-bold text-brand-950 bg-brand-500 hover:bg-brand-400 rounded-md transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)]"
          >
            {editingProperty ? 'Save Changes' : 'Create Property'}
          </button>
        </div>

      </div>
    </div>
  );
}
