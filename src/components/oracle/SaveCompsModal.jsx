import React, { useState, useEffect, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Database, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ── Asset class mapping (extraction → comps schema) ───────────────────────────
const ASSET_MAP = {
  industrial: 'Industrial', retail: 'Retail', office: 'Office',
  'mixed-use': 'Mixed Use', medical: 'Office', hospitality: 'Other', other: 'Other',
};
const mapAsset = (s) => (s ? (ASSET_MAP[s.toLowerCase()] ?? 'Other') : undefined);

// Handle "YYYY-MM" and "YYYY-MM-DD" date strings — pass through as-is
const cleanDate = (s) => (s && typeof s === 'string' ? s : undefined);

// ── Build saveable comp list from raw extraction data ─────────────────────────
function buildComps(data, extractionId) {
  const sp   = data.subject_property || {};
  const addr = sp.address || {};
  const imComps = data.comps_in_im || {};
  const groups = [];

  // 1. Existing tenancies → lease comps (subject property address)
  const tenancyComps = (data.tenancies || [])
    .filter(t => t.current_rent_pa || t.size_sqm)
    .map((t, i) => ({
      _key: `tenancy-${i}`,
      type: 'lease',
      address: addr.full || addr.street || '',
      suburb: addr.suburb || '',
      state: addr.state || undefined,
      assetType: mapAsset(sp.asset_class),
      nlaSqm: t.size_sqm ?? undefined,
      rentPa: t.current_rent_pa ?? undefined,
      rentInputFormat: 'annual',
      leaseDate: cleanDate(t.lease_start),
      notes: [t.tenant_name, t.permitted_use].filter(Boolean).join(' — ') || undefined,
      source: 'im_scan',
      linkedExtractionId: extractionId,
    }));
  if (tenancyComps.length > 0) groups.push({ label: 'Existing tenancies', comps: tenancyComps });

  // 2. Leasing comps from IM
  const leaseComps = (imComps.leasing || [])
    .filter(c => c.address)
    .map((c, i) => ({
      _key: `lease-${i}`,
      type: 'lease',
      address: c.address,
      suburb: c.suburb || addr.suburb || '',
      state: addr.state || undefined,
      assetType: mapAsset(c.asset_class || sp.asset_class),
      nlaSqm: c.nla_sqm ?? undefined,
      rentPa: c.rent_pa ?? undefined,
      rentInputFormat: 'annual',
      rentPerSqm: c.rent_per_sqm ?? undefined,
      leaseDate: cleanDate(c.lease_date),
      leaseTerm: c.term_years ? `${c.term_years} years` : undefined,
      notes: c.notes ?? undefined,
      source: 'im_scan',
      linkedExtractionId: extractionId,
    }));
  if (leaseComps.length > 0) groups.push({ label: 'Leasing comps in IM', comps: leaseComps });

  // 3. Sales comps from IM
  const saleComps = (imComps.sales || [])
    .filter(c => c.address)
    .map((c, i) => ({
      _key: `sale-${i}`,
      type: 'sale',
      address: c.address,
      suburb: c.suburb || addr.suburb || '',
      state: addr.state || undefined,
      assetType: mapAsset(c.asset_class || sp.asset_class),
      nlaSqm: c.nla_sqm ?? undefined,
      landAreaSqm: c.land_sqm ?? undefined,
      salePrice: c.sale_price ?? undefined,
      pricePerSqmBuild: c.price_per_sqm_build ?? undefined,
      pricePerSqmLand: c.price_per_sqm_land ?? undefined,
      capRate: c.yield_pct ?? undefined,
      saleDate: cleanDate(c.sale_date),
      notes: c.notes ?? undefined,
      source: 'im_scan',
      linkedExtractionId: extractionId,
    }));
  if (saleComps.length > 0) groups.push({ label: 'Sales comps in IM', comps: saleComps });

  return groups;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function SaveCompsModal({ isOpen, onClose, data, extractionId }) {
  const createComps = useMutation(api.comps.createComps);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const groups = useMemo(() => (data ? buildComps(data, extractionId) : []), [data, extractionId]);
  const allKeys = useMemo(() => groups.flatMap(g => g.comps.map(c => c._key)), [groups]);

  // All selected by default when modal opens
  const [selected, setSelected] = useState(new Set());
  useEffect(() => {
    if (isOpen) { setSelected(new Set(allKeys)); setSaved(false); }
  }, [isOpen, allKeys.join(',')]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleGroup = (keys) => {
    const allOn = keys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => allOn ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const handleSave = async () => {
    const toSave = groups
      .flatMap(g => g.comps)
      .filter(c => selected.has(c._key))
      // Strip internal _key before sending to Convex
      .map(({ _key, ...rest }) => rest);

    if (toSave.length === 0) return;
    setSaving(true);
    try {
      await createComps({ comps: toSave });
      setSaved(true);
      toast.success(`${toSave.length} comp${toSave.length > 1 ? 's' : ''} saved to database`);
      setTimeout(onClose, 800);
    } catch (e) {
      toast.error('Save failed', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const total = groups.reduce((s, g) => s + g.comps.length, 0);
  if (total === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#0F0F0F] border border-white/[0.08] rounded-xl w-full max-w-[560px] shadow-[0_24px_80px_rgba(0,0,0,0.7)] flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-white">Save to Comps DB</h2>
            <span className="text-xs text-brand-100/30">{total} found in scan</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-brand-100/40 hover:text-brand-100/80 hover:bg-white/[0.05] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {groups.map(group => {
            const keys = group.comps.map(c => c._key);
            const allOn = keys.every(k => selected.has(k));
            return (
              <div key={group.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/30">
                    {group.label} ({group.comps.length})
                  </span>
                  <button
                    onClick={() => toggleGroup(keys)}
                    className="text-[10px] text-brand-400/50 hover:text-brand-400 transition-colors"
                  >
                    {allOn ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {group.comps.map(comp => {
                    const on = selected.has(comp._key);
                    const metric = comp.type === 'lease'
                      ? (comp.rentPa ? `$${Math.round(comp.rentPa).toLocaleString()}/pa` : null)
                      : (comp.salePrice ? `$${(comp.salePrice >= 1e6 ? (comp.salePrice/1e6).toFixed(2)+'M' : comp.salePrice.toLocaleString())}` : null);
                    return (
                      <label
                        key={comp._key}
                        onClick={() => toggle(comp._key)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          on ? 'bg-brand-500/5 border-brand-500/20' : 'bg-white/[0.02] border-white/[0.05] opacity-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <span className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          on ? 'bg-brand-500/20 border-brand-500/60' : 'border-white/20'
                        }`}>
                          {on && <svg className="w-2.5 h-2.5 text-brand-400" fill="none" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>

                        {/* Type badge */}
                        <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
                          comp.type === 'lease' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {comp.type}
                        </span>

                        {/* Address */}
                        <span className="text-xs text-brand-100/70 truncate flex-1">
                          {comp.address}
                          {comp.suburb ? <span className="text-brand-100/35"> · {comp.suburb}</span> : null}
                        </span>

                        {/* Key metric */}
                        {metric && <span className="text-xs font-medium text-brand-300 shrink-0">{metric}</span>}
                        {comp.nlaSqm && <span className="text-xs text-brand-100/30 shrink-0">{comp.nlaSqm.toLocaleString()} m²</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between shrink-0">
          <span className="text-xs text-brand-100/30">
            {selected.size} of {total} selected
          </span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-sm text-brand-100/35 hover:text-brand-100/60 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={selected.size === 0 || saving || saved}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-brand-950 px-5 py-2 rounded-md text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95"
            >
              {saved
                ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
                : saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Database className="w-4 h-4" /> Save {selected.size} comp{selected.size !== 1 ? 's' : ''}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
