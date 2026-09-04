import React, { useEffect, useRef } from 'react';
import { toFormString } from '../../utils/number';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Building, MapPin, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { CustomSelect } from '../ui/CustomSelect';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  assetType: z.string().min(1, "Asset Type is required"),
  status: z.string().min(1, "Status is required"),
  askingPrice: z.string().optional().transform(v => v === '' ? undefined : Number(v)),
  estimatedYield: z.string().optional().transform(v => v === '' ? undefined : Number(v)),
  landArea: z.string().optional().transform(v => v === '' ? undefined : Number(v)),
  buildingArea: z.string().optional().transform(v => v === '' ? undefined : Number(v)),
  wales: z.string().optional().transform(v => v === '' ? undefined : Number(v)),
  description: z.string().optional(),
});

export function PropertyModal({ isOpen, onClose, editingProperty }) {
  const createProperty = useMutation(api.properties.createProperty);
  const updateProperty = useMutation(api.properties.updateProperty);
  const settings = useQuery(api.settings.getSettings);
  const { isLoaded: mapsLoaded, hasKey: mapsHasKey } = useGoogleMaps();

  // Ref for the address <input> — shared between RHF and Google Places Autocomplete
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const { register, handleSubmit, control, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: '',
      assetType: 'Retail',
      status: 'Off Market',
      askingPrice: '',
      estimatedYield: '',
      landArea: '',
      buildingArea: '',
      wales: '',
      description: '',
    }
  });

  useEffect(() => {
    if (editingProperty) {
      reset({
        address: editingProperty.address || '',
        assetType: editingProperty.assetType || 'Retail',
        status: editingProperty.status || 'Off Market',
        // toFormString, not `x ? String(x) : ''` — a stored 0 (expired WALE,
        // 0% yield, bare land with no building) loaded as blank, and saving
        // that blank deleted the field.
        askingPrice: toFormString(editingProperty.askingPrice),
        estimatedYield: toFormString(editingProperty.estimatedYield),
        landArea: toFormString(editingProperty.landArea),
        buildingArea: toFormString(editingProperty.buildingArea),
        wales: toFormString(editingProperty.wales),
        description: editingProperty.description || '',
      });
    } else {
      reset({
        address: '',
        assetType: 'Retail',
        status: 'Off Market',
        askingPrice: '',
        estimatedYield: '',
        landArea: '',
        buildingArea: '',
        wales: '',
        description: '',
      });
    }
  }, [editingProperty, isOpen, reset]);

  // Attach Google Places Autocomplete once the Maps SDK is ready and modal is open
  useEffect(() => {
    if (!isOpen || !mapsLoaded || !addressInputRef.current) return;
    if (autocompleteRef.current) return; // already attached

    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'au' },
      fields: ['formatted_address', 'address_components'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place?.formatted_address) return;

      setValue('address', place.formatted_address, { shouldValidate: true });

      // Auto-populate location (state) from address components if the field exists
      const stateComp = place.address_components?.find((c) =>
        c.types.includes('administrative_area_level_1')
      );
      if (stateComp) {
        setValue('location', stateComp.short_name, { shouldValidate: false });
      }
    });

    autocompleteRef.current = ac;

    return () => {
      // Clean up when modal closes
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isOpen, mapsLoaded, setValue]);

  const onSubmit = async (data) => {
    try {
      if (editingProperty) {
        await updateProperty({ id: editingProperty._id, ...data });
        toast.success("Property updated successfully");
      } else {
        await createProperty(data);
        toast.success("Property created successfully");
      }
      onClose();
    } catch (err) {
      console.error("Failed to save property", err);
      toast.error("Failed to save property.");
    }
  };

  return (
    <AnimatePresence>
      {(isOpen && settings) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
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
            className="bg-[#0A0A0A]/95 border border-white/5 w-full max-w-2xl rounded-xl shadow-2xl relative my-8 flex flex-col max-h-[90vh] z-10 overflow-hidden backdrop-blur-md"
          >
            
            {/* Header */}
            <div className="flex-none flex items-center justify-between p-6 border-b border-white/5">
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
              <form id="property-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Address */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="property-address" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider">Address *</label>
                    {mapsHasKey && !mapsLoaded && (
                      <span className="text-[10px] text-brand-100/40">Loading autocomplete…</span>
                    )}
                    {mapsLoaded && (
                      <span className="flex items-center gap-1 text-[10px] text-brand-100/45">
                        <MapPin className="w-3 h-3 text-brand-500/50" />
                        Autocomplete active
                      </span>
                    )}
                  </div>
                  <input
                    id="property-address"
                    type="text"
                    {...(({ ref: rhfRef, ...rest }) => {
                      return {
                        ...rest,
                        ref: (el) => {
                          rhfRef(el);
                          addressInputRef.current = el;
                        },
                      };
                    })(register('address'))}
                    placeholder={mapsLoaded ? 'Start typing an address…' : '123 Example Street, City, State'}
                    autoComplete="off"
                    className={`w-full bg-[#111] border ${errors.address ? 'border-red-500/50' : 'border-brand-800/50'} rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors`}
                  />
                  {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address.message}</p>}
                </div>

                {/* Classification Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Asset Type</label>
                    <Controller
                      name="assetType"
                      control={control}
                      render={({ field }) => (
                        <CustomSelect
                          ariaLabel="Asset type"
                          value={field.value}
                          onChange={field.onChange}
                          options={settings.assetTypes}
                          variant="form"
                        />
                      )}
                    />
                    {errors.assetType && <p className="text-red-400 text-xs mt-1">{errors.assetType.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Status</label>
                    <Controller
                      name="status"
                      control={control}
                      render={({ field }) => (
                        <CustomSelect
                          ariaLabel="Listing status"
                          value={field.value}
                          onChange={field.onChange}
                          options={['Off Market', 'On Market', 'Under Offer', 'Sold']}
                          variant="form"
                        />
                      )}
                    />
                    {errors.status && <p className="text-red-400 text-xs mt-1">{errors.status.message}</p>}
                  </div>
                </div>

                {/* Financials Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="property-asking-price" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Asking Price ($)</label>
                    <input
                      id="property-asking-price"
                      type="number"
                      {...register("askingPrice")}
                      placeholder="e.g. 5000000"
                      className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="property-estimated-yield" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Est. Yield (%)</label>
                    <input
                      id="property-estimated-yield"
                      type="number"
                      step="0.1"
                      {...register("estimatedYield")}
                      placeholder="e.g. 5.5"
                      className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="property-land-area" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Land Area (sqm)</label>
                    <input
                      id="property-land-area"
                      type="number"
                      {...register("landArea")}
                      className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="property-building-area" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Bldg Area (sqm)</label>
                    <input
                      id="property-building-area"
                      type="number"
                      {...register("buildingArea")}
                      className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="property-wales" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">WALE (Years)</label>
                    <input
                      id="property-wales"
                      type="number"
                      step="0.1"
                      {...register("wales")}
                      className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="property-description" className="block text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">Private Notes / Description</label>
                  <textarea
                    id="property-description"
                    {...register("description")}
                    rows={4}
                    className="w-full bg-[#111] border border-brand-800/50 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
                  />
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="flex-none p-6 border-t border-white/5 flex justify-end space-x-3 bg-white/[0.02]">
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
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-bold text-brand-950 bg-brand-500 hover:bg-brand-400 rounded-md transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSubmitting ? 'Saving…' : editingProperty ? 'Save Changes' : 'Create Property'}
              </button>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
