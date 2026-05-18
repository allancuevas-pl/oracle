import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Loader2 } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Helper to format numbers to currency
const formatCurrency = (val) => {
  if (!val) return "$0";
  if (val >= 1000000) {
    return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  }
  return "$" + val.toLocaleString();
};

export function BriefModal({ isOpen, onClose, editingBrief }) {
  const settings = useQuery(api.settings.getSettings);
  
  const createBrief = useMutation(api.briefs.createBrief);
  const updateBrief = useMutation(api.briefs.updateBrief);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [budgetRange, setBudgetRange] = useState([5000000, 20000000]);
  const [durationRange, setDurationRange] = useState([1, 3]);
  const [capitalInput, setCapitalInput] = useState("");
  const [selectedAssetTypes, setSelectedAssetTypes] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [selectedDebt, setSelectedDebt] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Reset or initialize state when modal opens or editingBrief changes
  useEffect(() => {
    if (isOpen) {
      if (editingBrief) {
        setBudgetRange([editingBrief.budgetMin || 0, editingBrief.budgetMax || 0]);
        setDurationRange([editingBrief.durationMin || 0, editingBrief.durationMax || 0]);
        setCapitalInput(editingBrief.capital ? editingBrief.capital.toLocaleString() : "");
        setSelectedAssetTypes(editingBrief.assetTypes || []);
        setSelectedStrategies(editingBrief.strategies || []);
        setSelectedDebt(editingBrief.debtStructure || []);
        setSelectedLocations(editingBrief.location || []);
      } else {
        setBudgetRange([5000000, 20000000]);
        setDurationRange([1, 3]);
        setCapitalInput("");
        setSelectedAssetTypes([]);
        setSelectedStrategies([]);
        setSelectedDebt([]);
        setSelectedLocations([]);
      }
    }
  }, [isOpen, editingBrief]);

  // Removed early return for AnimatePresence

  // Handle Tag Selection
  const toggleTag = (tag, list, setList) => {
    if (list.includes(tag)) {
      setList(list.filter(t => t !== tag));
    } else {
      setList([...list, tag]);
    }
  };

  // Handle Capital formatting
  const handleCapitalChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    if (!rawVal) {
      setCapitalInput("");
      return;
    }
    setCapitalInput(Number(rawVal).toLocaleString());
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.target);
    
    const rawCapital = Number(capitalInput.replace(/\D/g, ""));
    const payload = {
      clientName: formData.get("clientName"),
      stage: formData.get("stage"),
      priority: formData.get("priority"),
      capital: rawCapital || undefined,
      budgetMin: budgetRange[0],
      budgetMax: budgetRange[1],
      durationMin: durationRange[0],
      durationMax: durationRange[1],
      debtStructure: selectedDebt,
      location: selectedLocations,
      assetTypes: selectedAssetTypes,
      strategies: selectedStrategies,
      targets: formData.get("targets"),
      others: formData.get("others"),
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
  }

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
            className="bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] relative z-10 overflow-hidden backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-medium text-brand-50 tracking-tight">{editingBrief ? "Edit Brief" : "Create Structured Brief"}</h2>
              <button onClick={onClose} className="text-brand-100/50 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="create-brief-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* ROW 1: Client, Stage & Priority */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Client Name *</label>
                <input defaultValue={editingBrief?.clientName} required name="clientName" type="text" className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" placeholder="e.g. Smith Family Office" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Stage *</label>
                <select defaultValue={editingBrief?.stage || "Triage"} required name="stage" className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 appearance-none">
                  <option value="Triage">Triage</option>
                  <option value="Active Search">Active Search</option>
                  <option value="Offer Submitted">Offer Submitted</option>
                  <option value="Due Diligence">Due Diligence</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Priority</label>
                <select defaultValue={editingBrief?.priority || "Medium"} name="priority" className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 appearance-none">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
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
                  {/* Asset Types */}
                  <div>
                    <label className="block text-sm font-medium text-brand-100/70 mb-2">Asset Types</label>
                    <div className="flex flex-wrap gap-2">
                      {settings.assetTypes.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag, selectedAssetTypes, setSelectedAssetTypes)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selectedAssetTypes.includes(tag) 
                            ? "bg-brand-500/20 border-brand-500/50 text-brand-400" 
                            : "bg-[#0A0A0A] border-brand-800/50 text-brand-100/60 hover:border-brand-500/30"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Locations & Debt Structure */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-brand-100/70 mb-2">Locations</label>
                      <div className="flex flex-wrap gap-2">
                        {settings.locations.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag, selectedLocations, setSelectedLocations)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              selectedLocations.includes(tag) 
                              ? "bg-brand-500/20 border-brand-500/50 text-brand-400" 
                              : "bg-[#0A0A0A] border-brand-800/50 text-brand-100/60 hover:border-brand-500/30"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-100/70 mb-2">Debt Structure</label>
                      <div className="flex flex-wrap gap-2">
                        {settings.debtStructures.map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag, selectedDebt, setSelectedDebt)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              selectedDebt.includes(tag) 
                              ? "bg-brand-500/20 border-brand-500/50 text-brand-400" 
                              : "bg-[#0A0A0A] border-brand-800/50 text-brand-100/60 hover:border-brand-500/30"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strategies */}
                  <div>
                    <label className="block text-sm font-medium text-brand-100/70 mb-2">Strategies</label>
                    <div className="flex flex-wrap gap-2">
                      {settings.strategies.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag, selectedStrategies, setSelectedStrategies)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selectedStrategies.includes(tag) 
                            ? "bg-brand-500/20 border-brand-500/50 text-brand-400" 
                            : "bg-[#0A0A0A] border-brand-800/50 text-brand-100/60 hover:border-brand-500/30"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ROW 4: Financial Targets & Capital */}
            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-brand-800/30">
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Available Capital ($)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-brand-100/50">$</span>
                  <input 
                    value={capitalInput}
                    onChange={handleCapitalChange}
                    type="text" 
                    className="w-full bg-[#111] border border-brand-800/50 rounded-md pl-7 pr-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" 
                    placeholder="3,500,000" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-100/70 mb-1">Financial Targets</label>
                <input defaultValue={editingBrief?.targets} name="targets" type="text" className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" placeholder="e.g. Project Margin - 17%-20% Net After Tax" />
              </div>
            </div>

            {/* ROW 5: Notes */}
            <div>
              <label className="block text-sm font-medium text-brand-100/70 mb-1">Others (Notes / DD Requirements)</label>
              <textarea defaultValue={editingBrief?.others} name="others" rows={2} className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50" placeholder="e.g. Contamination – will review, require 60 days DD..."></textarea>
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
  );
}
