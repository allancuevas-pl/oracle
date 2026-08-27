import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { X, Plus, Check, Loader2, MapPin, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const fmt$ = (v) => {
  if (v == null) return '—';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'K';
  return '$' + Number(v).toLocaleString();
};
const fmtSqm = (v) => (v == null ? '—' : `${Math.round(v).toLocaleString()} m²`);
const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
};

function CompRow({ comp, linking, onLink }) {
  const isSale = comp.type === 'sale';
  const price = isSale ? comp.salePrice : comp.rentPa;
  const psm = isSale ? comp.pricePerSqmBuild : comp.rentPerSqm;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.015] hover:border-brand-500/25 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-brand-50 truncate flex items-center gap-1.5">
          {comp.address}
          {comp.sameSuburb === false && comp.suburb && (
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-amber-400/80 bg-amber-900/15 border border-amber-800/30 px-1.5 py-px rounded">
              {comp.suburb} · nearby
            </span>
          )}
        </p>
        <p className="text-[11px] text-brand-100/40 flex flex-wrap gap-x-2">
          <span>{fmtSqm(comp.nlaSqm)}</span>
          <span className="text-brand-500 font-semibold">{fmt$(price)}{isSale ? '' : ' pa'}</span>
          {psm ? <span>${Math.round(psm).toLocaleString()}/m²</span> : null}
          {comp.assetType ? <span>{comp.assetType}</span> : null}
          {fmtDate(comp.saleDate || comp.leaseDate) ? <span>{fmtDate(comp.saleDate || comp.leaseDate)}</span> : null}
        </p>
      </div>
      <button
        onClick={() => onLink(comp)}
        disabled={linking === comp._id}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-brand-950 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 transition-colors shrink-0"
      >
        {linking === comp._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        Add
      </button>
    </div>
  );
}

function CompSection({ title, comps, suburb, linking, onLink }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-100/45">
        {title} <span className="text-brand-100/25">({comps.length})</span>
      </p>
      {comps.length === 0
        ? <p className="text-xs text-brand-100/30 italic px-1">None found in {suburb}.</p>
        : <div className="space-y-1.5">{comps.map((c) => <CompRow key={c._id} comp={c} linking={linking} onLink={onLink} />)}</div>}
    </div>
  );
}

/**
 * Add comps → Suggested. Matches comps from Oracle's database by suburb + asset
 * type + size and lets staff one-click link them to this property, where they
 * flow straight into the Feaso evidence tables and the generated FEASO sheet.
 */
export function AddCompsModal({ isOpen, onClose, property, linkComp }) {
  const data = useQuery(
    api.comps.suggestCompsForProperty,
    isOpen ? { propertyId: property._id } : 'skip'
  );
  const [linking, setLinking] = useState(null); // comp _id being linked

  if (!isOpen) return null;

  const link = async (comp) => {
    setLinking(comp._id);
    try {
      await linkComp({ id: comp._id, linkedPropertyId: property._id });
      toast.success('Comp added to this deal');
    } catch (err) {
      toast.error(err?.message || 'Could not add comp');
    } finally {
      setLinking(null);
    }
  };

  const loading = data === undefined;
  const suburb = data?.suburb;
  const sales = data?.sales ?? [];
  const leases = data?.leases ?? [];
  const nothing = !loading && suburb && sales.length === 0 && leases.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#0A0A0A] border border-white/[0.08] rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-900/30 border border-brand-800/50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-brand-50">Suggested comps</h2>
              <p className="text-[11px] text-brand-100/40 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {suburb
                  ? `${suburb} first, then nearby${data?.state ? ` ${data.state}` : ''}${data?.assetType ? ` · ${data.assetType}` : ''}`
                  : 'Matched from the comp database'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-brand-100/40 hover:text-brand-100 hover:bg-white/[0.05] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-brand-500 animate-spin" /></div>
          )}
          {!loading && !suburb && (
            <div className="text-center py-10">
              <p className="text-sm text-brand-100/60">This property has no suburb set.</p>
              <p className="text-xs text-brand-100/35 mt-1">Add a suburb on the property (Edit) so Oracle can match comps nearby.</p>
            </div>
          )}
          {nothing && (
            <div className="text-center py-10">
              <p className="text-sm text-brand-100/60">No unlinked comps found in {suburb}.</p>
              <p className="text-xs text-brand-100/35 mt-1">Try the Comps page to search wider, or scan an agent's comp table.</p>
            </div>
          )}
          {!loading && suburb && !nothing && (
            <>
              <CompSection title="Sales evidence" comps={sales} suburb={suburb} linking={linking} onLink={link} />
              <CompSection title="Leasing evidence" comps={leases} suburb={suburb} linking={linking} onLink={link} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <p className="text-[11px] text-brand-100/35 flex items-center gap-1.5">
            <Check className="w-3 h-3 text-emerald-400/70" /> Added comps appear in the evidence tables + the FEASO sheet
          </p>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-xs font-semibold text-brand-100/70 bg-white/[0.03] border border-white/[0.08] hover:text-brand-100 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
