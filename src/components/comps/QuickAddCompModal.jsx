import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, ChevronDown, ChevronUp, Phone, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

const SOURCES = [
  { id: 'property_lions',  label: 'Property Lions' },
  { id: 'agent_call',      label: 'Agent call' },
  { id: 'real_commercial', label: 'RealCommercial' },
  { id: 'loopnet',         label: 'LoopNet' },
  { id: 'im_scan',         label: 'IM scan' },
  { id: 'other',           label: 'Other' },
];

const LEASE_TYPES  = ['Net', 'Gross', 'Semi-Gross'];
const REVIEW_TYPES = ['CPI', 'Fixed %', 'Market'];
const ASSET_TYPES  = ['Industrial', 'Retail', 'Office', 'Hybrid', 'Mixed Use', 'Other'];

const empty = {
  type: 'lease',
  address: '', suburb: '', state: '', postcode: '',
  assetType: '', nlaSqm: '', landAreaSqm: '',
  rentInput: '', rentInputFormat: 'annual',
  leaseType: '', leaseDate: '', leaseExpiry: '', leaseTerm: '', incentives: '', reviewType: '', reviewRate: '',
  salePrice: '', saleDate: '', capRate: '',
  source: '', verified: false,
  agentName: '', agentPhone: '', agentCompany: '',
  notes: '',
};

function compToForm(c) {
  return {
    type:            c.type ?? 'lease',
    address:         c.address ?? '',
    suburb:          c.suburb ?? '',
    state:           c.state ?? '',
    postcode:        c.postcode ?? '',
    assetType:       c.assetType ?? '',
    nlaSqm:          c.nlaSqm?.toString() ?? '',
    landAreaSqm:     c.landAreaSqm?.toString() ?? '',
    rentInput:       c.rentPa?.toString() ?? '',
    rentInputFormat: 'annual', // always stored as annual
    leaseType:       c.leaseType ?? '',
    leaseDate:       c.leaseDate ?? '',
    leaseExpiry:     c.leaseExpiry ?? '',
    leaseTerm:       c.leaseTerm ?? '',
    incentives:      c.incentives ?? '',
    reviewType:      c.reviewType ?? '',
    reviewRate:      c.reviewRate?.toString() ?? '',
    salePrice:       c.salePrice?.toString() ?? '',
    saleDate:        c.saleDate ?? '',
    capRate:         c.capRate?.toString() ?? '',
    source:          c.source ?? '',
    verified:        c.verified ?? false,
    agentName:       c.agentName ?? '',
    agentPhone:      c.agentPhone ?? '',
    agentCompany:    c.agentCompany ?? '',
    notes:           c.notes ?? '',
  };
}

export function QuickAddCompModal({ isOpen, onClose, existingComp, defaultPropertyId }) {
  const isEdit = !!existingComp;

  const [form, setForm]             = useState(empty);
  const [agentOpen, setAgentOpen]   = useState(false);
  const [termsOpen, setTermsOpen]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [confirmDelete, setConfirm] = useState(false);

  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const { isLoaded: mapsLoaded, hasKey: hasMapsKey } = useGoogleMaps();

  const settings    = useQuery(api.settings.getSettings);
  const createComp  = useMutation(api.comps.createComp);
  const updateComp  = useMutation(api.comps.updateComp);
  const deleteComp  = useMutation(api.comps.deleteComp);

  // Populate form from existingComp when opened
  useEffect(() => {
    if (!isOpen) return;
    if (existingComp) {
      const f = compToForm(existingComp);
      setForm(f);
      setAgentOpen(!!(existingComp.agentName || existingComp.agentPhone));
      setTermsOpen(!!(existingComp.leaseTerm || existingComp.reviewType || existingComp.incentives));
    } else {
      setForm(empty);
      setAgentOpen(false);
      setTermsOpen(false);
    }
    setConfirm(false);
  }, [isOpen, existingComp?._id]);

  // Attach Google Places Autocomplete
  useEffect(() => {
    if (!isOpen || !mapsLoaded || !addressInputRef.current) return;
    if (autocompleteRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'au' },
      fields: ['formatted_address', 'address_components'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place?.formatted_address) return;
      const get = (type, nameType = 'long_name') =>
        place.address_components?.find(c => c.types.includes(type))?.[nameType] ?? '';
      const suburb   = get('locality') || get('sublocality');
      const state    = get('administrative_area_level_1', 'short_name');
      const postcode = get('postal_code');
      setForm(f => ({
        ...f,
        address:  place.formatted_address,
        suburb:   suburb   || f.suburb,
        state:    state    || f.state,
        postcode: postcode || f.postcode,
      }));
    });

    autocompleteRef.current = ac;
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [isOpen, mapsLoaded]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const nla         = parseFloat(form.nlaSqm) || 0;
  const rentPaRaw   = parseFloat(form.rentInput) || 0;
  const rentPa      = form.rentInputFormat === 'monthly' ? rentPaRaw * 12 : rentPaRaw;
  const rentPerSqm  = nla > 0 && rentPa > 0 ? (rentPa / nla).toFixed(0) : null;
  const salePrice   = parseFloat(form.salePrice) || 0;
  const pricePerSqm = nla > 0 && salePrice > 0 ? (salePrice / nla).toFixed(0) : null;

  const buildPayload = () => ({
    address:    form.address.trim(),
    suburb:     form.suburb.trim(),
    state:      form.state || undefined,
    postcode:   form.postcode || undefined,
    assetType:  form.assetType || undefined,
    nlaSqm:     nla || undefined,
    landAreaSqm: parseFloat(form.landAreaSqm) || undefined,
    rentPa:     rentPa || undefined,
    rentInputFormat: form.rentInputFormat,
    leaseType:  form.leaseType || undefined,
    leaseDate:  form.leaseDate || undefined,
    leaseExpiry: form.leaseExpiry || undefined,
    leaseTerm:  form.leaseTerm || undefined,
    incentives: form.incentives || undefined,
    reviewType: form.reviewType || undefined,
    reviewRate: parseFloat(form.reviewRate) || undefined,
    salePrice:  salePrice || undefined,
    saleDate:   form.saleDate || undefined,
    capRate:    parseFloat(form.capRate) || undefined,
    source:     form.source || undefined,
    verified:   form.verified || undefined,
    agentName:  form.agentName || undefined,
    agentPhone: form.agentPhone || undefined,
    agentCompany: form.agentCompany || undefined,
    notes:      form.notes || undefined,
    linkedPropertyId: defaultPropertyId || existingComp?.linkedPropertyId || undefined,
  });

  const handleSave = async () => {
    if (!form.address.trim()) { toast.error('Address is required'); return; }
    if (!form.suburb.trim())  { toast.error('Suburb is required');  return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateComp({ id: existingComp._id, ...buildPayload() });
        toast.success('Comp updated');
      } else {
        await createComp({ type: form.type, ...buildPayload() });
        toast.success('Comp saved');
      }
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save comp');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirm(true); return; }
    try {
      await deleteComp({ id: existingComp._id });
      toast.success('Comp deleted');
      onClose();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (!isOpen) return null;

  const states  = settings?.locations ?? ['VIC','QLD','NSW','WA','SA','TAS','ACT','NT'];
  const isLease = form.type === 'lease';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/[0.08] rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-sm font-semibold text-white">{isEdit ? 'Edit Comp' : 'Add Comp'}</h2>
          <button onClick={onClose} className="text-brand-100/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Type toggle — locked in edit mode */}
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
            {['lease','sale'].map(t => (
              <button
                key={t}
                onClick={() => !isEdit && set('type', t)}
                disabled={isEdit}
                className={`flex-1 py-2.5 text-sm font-semibold capitalize transition-colors ${
                  form.type === t
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-brand-100/40'
                } ${isEdit ? 'cursor-default' : 'hover:text-brand-100/70'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Address + Suburb */}
          <div className="space-y-3">
            <Field label="Address *">
              <input
                ref={addressInputRef}
                className={inp}
                placeholder={mapsLoaded ? 'Start typing an address…' : '15 Boron Street, Sumner QLD'}
                value={form.address}
                onChange={e => set('address', e.target.value)}
              />
              {mapsLoaded
                ? <p className="text-[10px] text-brand-500/50 mt-1">Autocomplete active · suburb + state auto-fill</p>
                : hasMapsKey
                ? <p className="text-[10px] text-brand-100/40 mt-1">Loading autocomplete…</p>
                : <p className="text-[10px] text-brand-100/40 mt-1">Add a Google Maps key in Settings to enable autocomplete</p>
              }
            </Field>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Field label="Suburb *">
                  <input className={inp} placeholder="Sumner" value={form.suburb} onChange={e => set('suburb', e.target.value)} />
                </Field>
              </div>
              <Field label="State">
                <select className={inp} value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">—</option>
                  {states.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postcode">
                <input className={inp} placeholder="4074" value={form.postcode} onChange={e => set('postcode', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Property info */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Asset type">
              <select className={inp} value={form.assetType} onChange={e => set('assetType', e.target.value)}>
                <option value="">—</option>
                {ASSET_TYPES.map(a => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="NLA (sqm)">
              <input className={inp} type="number" placeholder="2 087" value={form.nlaSqm} onChange={e => set('nlaSqm', e.target.value)} />
            </Field>
            <Field label="Land (sqm)">
              <input className={inp} type="number" placeholder="3 876" value={form.landAreaSqm} onChange={e => set('landAreaSqm', e.target.value)} />
            </Field>
          </div>

          {/* Lease fields */}
          {isLease && (
            <div className="space-y-3">
              <Field label="Rent">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/45 text-sm">$</span>
                    <input className={inp + ' pl-6'} type="number" placeholder="320 000" value={form.rentInput} onChange={e => set('rentInput', e.target.value)} />
                  </div>
                  <div className="flex rounded-md border border-white/[0.08] overflow-hidden shrink-0">
                    {['annual','monthly'].map(f => (
                      <button key={f} onClick={() => set('rentInputFormat', f)}
                        className={`px-3 py-2 text-xs font-medium transition-colors ${form.rentInputFormat === f ? 'bg-brand-500/15 text-brand-400' : 'text-brand-100/40 hover:text-brand-100/60'}`}>
                        {f === 'annual' ? '$/pa' : '$/mo'}
                      </button>
                    ))}
                  </div>
                </div>
                {rentPerSqm && (
                  <p className="text-xs text-brand-500/70 mt-1">
                    = ${rentPerSqm}/sqm · {form.rentInputFormat === 'monthly'
                      ? `$${rentPa.toLocaleString()}/pa`
                      : `$${Math.round(rentPa/12).toLocaleString()}/mo`}
                  </p>
                )}
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Lease type">
                  <select className={inp} value={form.leaseType} onChange={e => set('leaseType', e.target.value)}>
                    <option value="">—</option>
                    {LEASE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Lease date">
                  <input className={inp} type="date" value={form.leaseDate} onChange={e => set('leaseDate', e.target.value)} />
                </Field>
                <Field label="Expiry">
                  <input className={inp} type="date" value={form.leaseExpiry} onChange={e => set('leaseExpiry', e.target.value)} />
                </Field>
              </div>
              <button onClick={() => setTermsOpen(o => !o)} className="flex items-center gap-1.5 text-xs text-brand-100/40 hover:text-brand-100/70 transition-colors">
                {termsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Lease terms & reviews
              </button>
              {termsOpen && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Term"><input className={inp} placeholder="3yr" value={form.leaseTerm} onChange={e => set('leaseTerm', e.target.value)} /></Field>
                    <Field label="Review type">
                      <select className={inp} value={form.reviewType} onChange={e => set('reviewType', e.target.value)}>
                        <option value="">—</option>
                        {REVIEW_TYPES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </Field>
                    <Field label="Rate %"><input className={inp} type="number" placeholder="3.5" step="0.1" value={form.reviewRate} onChange={e => set('reviewRate', e.target.value)} /></Field>
                  </div>
                  <Field label="Incentives">
                    <input className={inp} placeholder="e.g. 6 months rent-free, $50K fitout contribution" value={form.incentives} onChange={e => set('incentives', e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* Sale fields */}
          {!isLease && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sale price">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/45 text-sm">$</span>
                    <input className={inp + ' pl-6'} type="number" placeholder="4 000 000" value={form.salePrice} onChange={e => set('salePrice', e.target.value)} />
                  </div>
                  {pricePerSqm && <p className="text-xs text-brand-500/70 mt-1">= ${pricePerSqm}/sqm</p>}
                </Field>
                <Field label="Settlement date">
                  <input className={inp} type="date" value={form.saleDate} onChange={e => set('saleDate', e.target.value)} />
                </Field>
              </div>
              <Field label="Cap rate %">
                <input className={inp} type="number" placeholder="6.25" step="0.01" value={form.capRate} onChange={e => set('capRate', e.target.value)} />
              </Field>
            </div>
          )}

          {/* Source */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Source</p>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map(s => (
                <button key={s.id} onClick={() => set('source', form.source === s.id ? '' : s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    form.source === s.id
                      ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                      : 'border-white/[0.06] text-brand-100/40 hover:text-brand-100/70 hover:border-white/10'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <div onClick={() => set('verified', !form.verified)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${form.verified ? 'bg-brand-500 border-brand-500' : 'border-white/20'}`}>
                {form.verified && <Check className="w-2.5 h-2.5 text-brand-950" />}
              </div>
              <span className="text-xs text-brand-100/50">Verbally verified</span>
            </label>
          </div>

          {/* Agent details */}
          <div>
            <button onClick={() => setAgentOpen(o => !o)} className="flex items-center gap-1.5 text-xs text-brand-100/40 hover:text-brand-100/70 transition-colors">
              {agentOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <Phone className="w-3 h-3" />
              Agent details
            </button>
            {agentOpen && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Field label="Name"><input className={inp} placeholder="John Smith" value={form.agentName} onChange={e => set('agentName', e.target.value)} /></Field>
                <Field label="Phone"><input className={inp} placeholder="04xx xxx xxx" value={form.agentPhone} onChange={e => set('agentPhone', e.target.value)} /></Field>
                <Field label="Company"><input className={inp} placeholder="JLL" value={form.agentCompany} onChange={e => set('agentCompany', e.target.value)} /></Field>
              </div>
            )}
          </div>

          {/* Notes */}
          <Field label="Notes">
            <textarea className={inp + ' resize-none h-16'} placeholder="e.g. 3yr lease, 3% fixed reviews, 6mo incentive" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </Field>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between shrink-0">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  confirmDelete ? 'text-red-400 font-semibold' : 'text-brand-100/45 hover:text-red-400'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-brand-100/50 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-brand-500 text-brand-950 text-sm font-semibold rounded-md hover:bg-brand-400 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save comp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  // Wrapping the control inside the <label> gives implicit association — the
  // label is announced with its input by screen readers, no id wiring needed.
  return (
    <label className="block space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">{label}</span>
      {children}
    </label>
  );
}

const inp = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-brand-100/80 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/40 transition-colors';
