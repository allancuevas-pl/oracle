import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Plus, Database, Search, Loader2, CheckCircle2, Phone, SlidersHorizontal, X } from 'lucide-react';
import { QuickAddCompModal } from '../components/comps/QuickAddCompModal';
import { CompFilters } from '../components/comps/CompFilters';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────────────────
const TYPE_TABS = ['All', 'Lease', 'Sale'];
const NLA_MAX  = 10_000;
const LAND_MAX = 20_000;

const DEFAULT_FILTERS = {
  state: '', assetTypes: [], dateRange: 'any',
  nlaMin: 0, nlaMax: NLA_MAX, landMin: 0, landMax: LAND_MAX,
};

const SOURCE_LABELS = {
  agent_call: 'Agent call', real_commercial: 'RealCommercial',
  loopnet: 'LoopNet', im_scan: 'IM scan', other: 'Other',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n) return null;
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${n.toLocaleString()}`;
}
function fmtSqm(n) { return n ? `$${Math.round(n).toLocaleString()}/sqm` : null; }

function getDateCutoff(range) {
  if (range === 'any') return null;
  const d = new Date();
  if (range === '3mo')  d.setDate(d.getDate() - 90);
  else if (range === '6mo')  d.setDate(d.getDate() - 180);
  else if (range === '12mo') d.setDate(d.getDate() - 365);
  return d.toISOString().split('T')[0]; // "YYYY-MM-DD" — ISO string comparison works correctly
}

function countActiveFilters(f) {
  return [
    f.state !== '',
    f.assetTypes.length > 0,
    f.dateRange !== 'any',
    f.nlaMin !== 0 || f.nlaMax !== NLA_MAX,
    f.landMin !== 0 || f.landMax !== LAND_MAX,
  ].filter(Boolean).length;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Comps() {
  const [tab, setTab]               = useState('All');
  const [search, setSearch]         = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]       = useState(DEFAULT_FILTERS);
  const [selected, setSelected]     = useState(new Set());   // Set of comp IDs
  const [assignPropId, setAssignPropId] = useState('');
  const [assigning, setAssigning]   = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingComp, setEditingComp] = useState(null);

  const openAdd  = () => { setEditingComp(null); setModalOpen(true); };
  const openEdit = (c) => { setEditingComp(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingComp(null); };

  const typeFilter = tab === 'All' ? undefined : tab.toLowerCase();
  const comps      = useQuery(api.comps.getComps, { type: typeFilter });
  const properties = useQuery(api.properties.getProperties, selected.size > 0 ? {} : 'skip');
  const linkComp   = useMutation(api.comps.linkCompToProperty);

  const activeFilterCount = countActiveFilters(filters);
  const dateCutoff        = getDateCutoff(filters.dateRange);

  const filtered = useMemo(() => {
    if (!comps) return [];
    return comps.filter(c => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        if (!c.address.toLowerCase().includes(q) &&
            !c.suburb.toLowerCase().includes(q) &&
            !(c.assetType?.toLowerCase().includes(q))) return false;
      }
      // State
      if (filters.state && c.state !== filters.state) return false;
      // Asset types (multi-select)
      if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(c.assetType)) return false;
      // Date cutoff
      if (dateCutoff) {
        const date = c.type === 'lease' ? c.leaseDate : c.saleDate;
        if (!date || date < dateCutoff) return false;
      }
      // NLA range (skip if no NLA recorded)
      if (filters.nlaMin !== 0 || filters.nlaMax !== NLA_MAX) {
        if (!c.nlaSqm) return false;
        if (c.nlaSqm < filters.nlaMin || c.nlaSqm > filters.nlaMax) return false;
      }
      // Land range
      if (filters.landMin !== 0 || filters.landMax !== LAND_MAX) {
        if (!c.landAreaSqm) return false;
        if (c.landAreaSqm < filters.landMin || c.landAreaSqm > filters.landMax) return false;
      }
      return true;
    });
  }, [comps, search, filters, dateCutoff]);

  // Selection helpers
  const toggleSelect = useCallback((e, id) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => {
    setSelected(prev => prev.size === filtered.length
      ? new Set()
      : new Set(filtered.map(c => c._id)));
  }, [filtered]);
  const clearSelection = () => { setSelected(new Set()); setAssignPropId(''); };

  // Bulk assign
  const handleAssign = async () => {
    if (!assignPropId || selected.size === 0) return;
    setAssigning(true);
    try {
      await Promise.all([...selected].map(id =>
        linkComp({ id, linkedPropertyId: assignPropId })
      ));
      toast.success(`${selected.size} comp${selected.size > 1 ? 's' : ''} linked to property`);
      clearSelection();
    } catch {
      toast.error('Failed to assign comps');
    } finally {
      setAssigning(false);
    }
  };

  const allChecked  = filtered.length > 0 && selected.size === filtered.length;
  const someChecked = selected.size > 0 && selected.size < filtered.length;

  return (
    <div className="p-6 lg:p-8 space-y-6 h-full flex flex-col">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <Database className="w-6 h-6 mr-3 text-brand-500" />
            Comps
          </h1>
          <p className="text-sm text-brand-100/50 mt-1">Lease and sale evidence. Grows with every deal.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center justify-center shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Comp
        </button>
      </div>

      {/* Table card */}
      <div className="flex-1 bg-[#0A0A0A] border border-brand-800/30 rounded-xl overflow-hidden flex flex-col shadow-xl">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-brand-800/30 bg-[#111] flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/30" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search address, suburb…"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-md pl-9 pr-3 py-2 text-sm text-brand-100/80 placeholder:text-brand-100/20 focus:outline-none focus:border-brand-500/30 transition-colors"
            />
          </div>

          {/* Type tabs */}
          <div className="flex rounded-md border border-white/[0.06] overflow-hidden">
            {TYPE_TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t ? 'bg-brand-500/15 text-brand-400' : 'text-brand-100/40 hover:text-brand-100/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                : 'bg-white/[0.03] border-white/[0.06] text-brand-100/40 hover:text-brand-100/70'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-brand-500/30 text-brand-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Count + selection summary */}
          <div className="ml-auto flex items-center gap-3 text-xs text-brand-100/30">
            {selected.size > 0 && (
              <span className="text-brand-400">
                {selected.size} selected
              </span>
            )}
            <span>{comps === undefined ? '' : `${filtered.length} ${filtered.length === 1 ? 'comp' : 'comps'}`}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {comps === undefined ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Database className="w-8 h-8 text-brand-100/10 mb-3" />
              <p className="text-sm text-brand-100/30">
                {comps.length === 0 ? 'No comps yet' : 'No comps match the current filters'}
              </p>
              {comps.length === 0 && (
                <p className="text-xs text-brand-100/20 mt-1">Add one manually or save comps from an IM scan</p>
              )}
              {comps.length > 0 && activeFilterCount > 0 && (
                <button onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {/* Select-all checkbox */}
                  <th className="pl-4 pr-2 py-3 w-8 bg-[#0A0A0A]/50">
                    <CheckboxCell
                      checked={allChecked}
                      indeterminate={someChecked}
                      onChange={toggleAll}
                    />
                  </th>
                  {tab === 'All' && <Th>Type</Th>}
                  <Th>Address</Th>
                  <Th>Suburb</Th>
                  <Th>Asset</Th>
                  <Th>NLA</Th>
                  {tab !== 'Sale'  && <Th>Rent/pa</Th>}
                  {tab !== 'Sale'  && <Th>$/sqm</Th>}
                  {tab !== 'Lease' && <Th>Sale price</Th>}
                  {tab !== 'Lease' && <Th>$/sqm</Th>}
                  {tab === 'Sale'  && <Th>Cap rate</Th>}
                  <Th>Date</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const isSelected = selected.has(c._id);
                  return (
                    <tr key={c._id}
                      onClick={() => openEdit(c)}
                      className={`border-b border-white/[0.03] transition-colors cursor-pointer ${
                        isSelected ? 'bg-brand-500/5 hover:bg-brand-500/8' : 'hover:bg-brand-900/10'
                      }`}
                    >
                      <td className="pl-4 pr-2 py-3 w-8" onClick={e => toggleSelect(e, c._id)}>
                        <CheckboxCell checked={isSelected} />
                      </td>
                      {tab === 'All' && (
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                            c.type === 'lease' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {c.type}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <p className="text-brand-100/80 font-medium truncate max-w-[200px]">{c.address}</p>
                      </td>
                      <td className="px-4 py-3 text-brand-100/50">{c.suburb}</td>
                      <td className="px-4 py-3 text-brand-100/50">{c.assetType ?? <Unset />}</td>
                      <td className="px-4 py-3 text-brand-100/50">
                        {c.nlaSqm ? `${c.nlaSqm.toLocaleString()} sqm` : <Unset />}
                      </td>
                      {tab !== 'Sale' && (
                        <>
                          <td className="px-4 py-3 text-brand-100/70 font-medium">{c.rentPa ? fmt(c.rentPa) : <Unset />}</td>
                          <td className="px-4 py-3 text-brand-100/50">{c.rentPerSqm ? fmtSqm(c.rentPerSqm) : <Unset />}</td>
                        </>
                      )}
                      {tab !== 'Lease' && (
                        <>
                          <td className="px-4 py-3 text-brand-100/70 font-medium">{c.salePrice ? fmt(c.salePrice) : <Unset />}</td>
                          <td className="px-4 py-3 text-brand-100/50">{c.pricePerSqmBuild ? fmtSqm(c.pricePerSqmBuild) : <Unset />}</td>
                        </>
                      )}
                      {tab === 'Sale' && (
                        <td className="px-4 py-3 text-brand-100/50">{c.capRate ? `${c.capRate}%` : <Unset />}</td>
                      )}
                      <td className="px-4 py-3 text-brand-100/40 text-xs">
                        {(c.type === 'lease' ? c.leaseDate : c.saleDate) ?? <Unset />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {c.source && (
                            <span className="text-[10px] text-brand-100/35 bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded-full">
                              {SOURCE_LABELS[c.source] ?? c.source}
                            </span>
                          )}
                          {c.verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" title="Verbally verified" />}
                          {c.agentPhone && <Phone className="w-3 h-3 text-brand-100/20" title={`${c.agentName ?? ''} ${c.agentPhone}`} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bulk assign bar — slides up when comps are selected */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-[#141414] border border-brand-500/20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] text-sm animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-brand-300 font-semibold whitespace-nowrap">
            {selected.size} {selected.size === 1 ? 'comp' : 'comps'} selected
          </span>

          <div className="w-px h-5 bg-white/[0.08]" />

          <span className="text-brand-100/40 text-xs whitespace-nowrap">Add to property:</span>
          <select
            value={assignPropId}
            onChange={e => setAssignPropId(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.10] rounded-md px-3 py-1.5 text-xs text-brand-100/70 focus:outline-none focus:border-brand-500/40 min-w-[180px] max-w-[260px]"
          >
            <option value="">Pick a property…</option>
            {(properties ?? []).map(p => (
              <option key={p._id} value={p._id}>{p.address}</option>
            ))}
          </select>

          <button
            onClick={handleAssign}
            disabled={!assignPropId || assigning}
            className="bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-brand-950 px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            {assigning && <Loader2 className="w-3 h-3 animate-spin" />}
            Assign
          </button>

          <button onClick={clearSelection} className="text-brand-100/30 hover:text-brand-100/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <CompFilters
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(DEFAULT_FILTERS)}
        activeCount={activeFilterCount}
      />

      <QuickAddCompModal isOpen={modalOpen} onClose={closeModal} existingComp={editingComp} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-brand-100/30 bg-[#0A0A0A]/50 whitespace-nowrap">
      {children}
    </th>
  );
}

function Unset() {
  return <span className="text-brand-100/20 italic">—</span>;
}

function CheckboxCell({ checked, indeterminate, onChange }) {
  return (
    <label
      onClick={e => e.stopPropagation()}
      className="flex items-center justify-center cursor-pointer"
    >
      <input
        type="checkbox"
        checked={checked ?? false}
        ref={el => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={onChange ?? (() => {})}
        className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-brand-500 cursor-pointer"
      />
    </label>
  );
}
