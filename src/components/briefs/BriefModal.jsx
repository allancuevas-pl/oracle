import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Loader2, UserPlus } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { CustomSelect } from '../ui/CustomSelect';
import { ClientModal } from '../clients/ClientModal';
import { useForm, Controller } from 'react-hook-form';
import { toDateInput, fromDateInput } from '../../utils/briefDate';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { formatCurrency } from '../../utils/format';
import { TagPicker } from '../ui/TagPicker';

const briefSchema = z.object({
  stage: z.string().min(1, "Stage is required"),
  priority: z.string().min(1, "Priority is required"),
  capital: z.string().optional(),
  targets: z.string().optional(),
  others: z.string().optional(),
});

const DEFAULT_BUDGET = [5000000, 20000000];
const DEFAULT_DURATION = [1, 3];

export function BriefModal({ isOpen, onClose, editingBrief, preselectedClient }) {
  // Skip subscriptions when closed — modal is always mounted, so without
  // 'skip' these fire even when the user isn't looking at the form.
  const settings = useQuery(api.settings.getSettings, isOpen ? {} : 'skip');
  const clients = useQuery(api.clients.getClientSummaries, isOpen ? {} : 'skip');

  const createBrief = useMutation(api.briefs.createBrief);
  const updateBrief = useMutation(api.briefs.updateBrief);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Client selection state (not managed by RHF)
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');

  // Non-RHF State for complex inputs
  const [budgetRange, setBudgetRange] = useState(DEFAULT_BUDGET);
  const [durationRange, setDurationRange] = useState(DEFAULT_DURATION);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [selectedDebt, setSelectedDebt] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(briefSchema),
    defaultValues: {
      stage: 'Triage',
      priority: 'Medium',
      capital: '',
      targets: '',
      others: '',
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (editingBrief) {
        setBudgetRange(
          editingBrief.budgetMin != null && editingBrief.budgetMax != null
            ? [editingBrief.budgetMin, editingBrief.budgetMax]
            : DEFAULT_BUDGET,
        );
        setDurationRange(
          editingBrief.durationMin != null && editingBrief.durationMax != null
            ? [editingBrief.durationMin, editingBrief.durationMax]
            : DEFAULT_DURATION,
        );
        setSelectedAssetTypes(editingBrief.assetTypes || []);
        setSelectedStrategies(editingBrief.strategies || []);
        setSelectedDebt(editingBrief.debtStructure || []);
        setSelectedLocations(editingBrief.location || []);
        setSelectedClientId(editingBrief.clientId || '');
        setSelectedClientName(editingBrief.clientName || '');

        reset({
          stage: editingBrief.stage || 'Triage',
          priority: editingBrief.priority || 'Medium',
          capital: editingBrief.capital ? editingBrief.capital.toLocaleString() : '',
          // Fall back to the record's creation time: 4 of the 9 live briefs
          // predate the startDate field, and showing them blank would invite
          // saving a blank over a date the header is already deriving from.
          startDate: toDateInput(editingBrief.startDate ?? editingBrief._creationTime),
          targets: editingBrief.targets || '',
          others: editingBrief.others || '',
        });
      } else {
        setBudgetRange(DEFAULT_BUDGET);
        setDurationRange(DEFAULT_DURATION);
        setSelectedAssetTypes([]);
        setSelectedStrategies([]);
        setSelectedDebt([]);
        setSelectedLocations([]);
        // Pre-fill client when opened from a client record
        setSelectedClientId(preselectedClient?.id || '');
        setSelectedClientName(preselectedClient?.name || '');

        reset({
          stage: 'Triage',
          priority: 'Medium',
          capital: '',
          startDate: toDateInput(Date.now()),
          targets: '',
          others: '',
        });
      }
    }
  }, [isOpen, editingBrief, preselectedClient, reset]);

  const toggleTag = (tag, list, setList) => {
    if (list.includes(tag)) {
      setList(list.filter(t => t !== tag));
    } else {
      setList([...list, tag]);
    }
  };

  const onSubmit = async (data) => {
    if (!selectedClientId) {
      toast.error("Please select a client before saving.");
      return;
    }

    setIsSubmitting(true);

    const rawCapital = data.capital ? Number(data.capital.replace(/\D/g, "")) : undefined;

    const payload = {
      clientId: selectedClientId,
      clientName: selectedClientName,
      stage: data.stage,
      priority: data.priority,
      capital: rawCapital,
      budgetMin: budgetRange[0],
      budgetMax: budgetRange[1],
      durationMin: durationRange[0],
      durationMax: durationRange[1],
      debtStructure: selectedDebt,
      location: selectedLocations,
      assetTypes: selectedAssetTypes,
      strategies: selectedStrategies,
      startDate: fromDateInput(data.startDate),
      targets: data.targets,
      others: data.others,
    };

    try {
      if (editingBrief) {
        await updateBrief({ id: editingBrief._id, ...payload });
        toast.success("Brief updated successfully");
      } else {
        await createBrief(payload);
        toast.success("Brief created successfully");
      }
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save brief.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <ClientModal
      isOpen={isClientModalOpen}
      onClose={() => setIsClientModalOpen(false)}
      editingClient={null}
      onCreated={(newClient) => {
        setSelectedClientId(newClient._id);
        setSelectedClientName(newClient.name);
      }}
    />
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
            className="bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] relative z-10 overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-medium text-brand-50 tracking-tight">{editingBrief ? "Edit Brief" : "Create Structured Brief"}</h2>
              <button onClick={onClose} className="text-brand-100/50 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="create-brief-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* ROW 1: Client, Stage & Priority */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-brand-100/70">Client *</label>
                  {!preselectedClient && (
                    <button
                      type="button"
                      onClick={() => setIsClientModalOpen(true)}
                      className="flex items-center text-xs text-brand-500 hover:text-brand-400 transition-colors"
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      New
                    </button>
                  )}
                </div>
                {preselectedClient ? (
                  // Locked to the client this brief is being created for
                  <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/5 border border-brand-500/20 rounded-md">
                    <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-brand-400">
                        {preselectedClient.name?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-brand-50 font-medium truncate">{preselectedClient.name}</span>
                  </div>
                ) : (
                  <CustomSelect
                    ariaLabel="Client"
                    value={selectedClientId}
                    onChange={(clientId) => {
                      const client = clients?.find(c => c._id === clientId);
                      setSelectedClientId(clientId);
                      setSelectedClientName(client?.name ?? '');
                    }}
                    options={(clients ?? []).map(c => ({
                      value: c._id,
                      label: c.name + (c.company ? ` (${c.company})` : ''),
                    }))}
                    placeholder="Select client..."
                    variant="form"
                    error={!selectedClientId}
                  />
                )}
                {!selectedClientId && <p className="text-red-400/70 text-xs mt-1">Client is required</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Stage *</label>
                <Controller
                  name="stage"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      ariaLabel="Brief stage"
                      value={field.value}
                      onChange={field.onChange}
                      options={['Triage', 'Active Search', 'Offer Submitted', 'Due Diligence']}
                      variant="form"
                    />
                  )}
                />
                {errors.stage && <p className="text-red-400 text-xs mt-1">{errors.stage.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Priority</label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      ariaLabel="Brief priority"
                      value={field.value}
                      onChange={field.onChange}
                      options={['High', 'Medium', 'Low']}
                      variant="form"
                    />
                  )}
                />
              </div>
            </div>

            {/* ROW 2: Sliders (Budget & Duration) */}
            <div className="grid grid-cols-2 gap-8 p-5 bg-[#0A0A0A]/50 rounded-lg border border-brand-800/30">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-sm font-medium text-brand-100/70">Budget Range</label>
                  <span className="text-sm font-semibold text-brand-500">
                    {formatCurrency(budgetRange[0])} - {formatCurrency(budgetRange[1])}
                  </span>
                </div>
                <div className="pt-2 px-2">
                  <Slider 
                    range 
                    min={0} 
                    max={100000000} 
                    step={100000} 
                    value={budgetRange} 
                    onChange={setBudgetRange}
                    trackStyle={[{ backgroundColor: '#D4AF37' }]}
                    handleStyle={[
                      { borderColor: '#D4AF37', backgroundColor: '#D4AF37' },
                      { borderColor: '#D4AF37', backgroundColor: '#D4AF37' }
                    ]}
                    railStyle={{ backgroundColor: '#333' }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-sm font-medium text-brand-100/70">Target Duration</label>
                  <span className="text-sm font-semibold text-brand-500">
                    {durationRange[0]} to {durationRange[1]} years
                  </span>
                </div>
                <div className="pt-2 px-2">
                  <Slider 
                    range 
                    min={0} 
                    max={10} 
                    step={1} 
                    value={durationRange} 
                    onChange={setDurationRange}
                    trackStyle={[{ backgroundColor: '#D4AF37' }]}
                    handleStyle={[
                      { borderColor: '#D4AF37', backgroundColor: '#D4AF37' },
                      { borderColor: '#D4AF37', backgroundColor: '#D4AF37' }
                    ]}
                    railStyle={{ backgroundColor: '#333' }}
                  />
                </div>
              </div>
            </div>

            {/* ROW 3: Dynamic Tags Container */}
            <div className="space-y-6">
              {!settings ? (
                <div className="text-xs text-brand-100/50">Loading settings...</div>
              ) : (
                <>
                  <TagPicker
                    label="Asset Types"
                    tags={settings.assetTypes}
                    selected={selectedAssetTypes}
                    onToggle={(tag) => toggleTag(tag, selectedAssetTypes, setSelectedAssetTypes)}
                    allowOther
                  />
                  <div className="grid grid-cols-2 gap-6">
                    <TagPicker
                      label="Locations"
                      tags={settings.locations}
                      selected={selectedLocations}
                      onToggle={(tag) => toggleTag(tag, selectedLocations, setSelectedLocations)}
                    />
                    <TagPicker
                      label="Debt Structure"
                      tags={settings.debtStructures}
                      selected={selectedDebt}
                      onToggle={(tag) => toggleTag(tag, selectedDebt, setSelectedDebt)}
                    />
                  </div>
                  <TagPicker
                    label="Strategies"
                    tags={settings.strategies}
                    selected={selectedStrategies}
                    onToggle={(tag) => toggleTag(tag, selectedStrategies, setSelectedStrategies)}
                    allowOther
                  />
                </>
              )}
            </div>

            {/* ROW 4: Financial Targets & Capital */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-brand-800/30">
              <div>
                <label htmlFor="brief-capital" className="block text-sm font-medium text-brand-100/70 mb-1">Available Capital ($)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-brand-100/50">$</span>
                  <input
                    id="brief-capital"
                    {...register("capital", {
                      onChange: (e) => {
                        const rawVal = e.target.value.replace(/\D/g, "");
                        if (rawVal) {
                          setValue("capital", Number(rawVal).toLocaleString());
                        } else {
                          setValue("capital", "");
                        }
                      }
                    })}
                    type="text" 
                    className="w-full bg-[#111] border border-brand-800/50 rounded-md pl-7 pr-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" 
                    placeholder="3,500,000" 
                  />
                </div>
              </div>
              <div>
                <label htmlFor="brief-start-date" className="block text-sm font-medium text-brand-100/70 mb-1">Date Opened</label>
                <input id="brief-start-date" {...register("startDate")} type="date" className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" />
                <p className="text-[11px] text-brand-100/35 mt-1">When the mandate opened — drives &ldquo;Opened N days ago&rdquo;.</p>
              </div>
              <div>
                <label htmlFor="brief-targets" className="block text-sm font-medium text-brand-100/70 mb-1">Financial Targets</label>
                <input id="brief-targets" {...register("targets")} type="text" className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" placeholder="e.g. Project Margin - 17%-20% Net After Tax" />
              </div>
            </div>

            {/* ROW 5: Notes */}
            <div>
              <label htmlFor="brief-others" className="block text-sm font-medium text-brand-100/70 mb-1">Others (Notes / DD Requirements)</label>
              <textarea id="brief-others" {...register("others")} rows={2} className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" placeholder="e.g. Contamination – will review, require 60 days DD..."></textarea>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-brand-800/30 flex justify-end space-x-3 bg-[#0A0A0A]/50">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-brand-100/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="create-brief-form"
            disabled={isSubmitting}
            className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Brief
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
    </>
  );
}
