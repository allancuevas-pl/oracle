import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Plus, Database, Search, Loader2, CheckCircle2, Phone, SlidersHorizontal, X, ArrowUp, ArrowDown } from 'lucide-react';
import { QuickAddCompModal } from '../components/comps/QuickAddCompModal';
import { CompFilters } from '../components/comps/CompFilters';
import { SkeletonTable } from '../components/ui/Loading';
import { rowEntrance } from '../components/ui/motion';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────────────────
const TYPE_TABS = ['All', 'Lease', 'Sale'];
const SOURCE_OPTIONS = [
  { value: 'historical_import', label: 'Curated (team)' },
  { value: 'arealytics',        label: 'Arealytics' },
  { value: 'im_scan',           label: 'IM scans' },
  { value: 'all',               label: 'All sources' },
];
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

// Value a comp sorts by for a given column key. The Date column is type-dependent.
function sortValue(c, key) {
  if (key === 'date') return c.type === 'lease' ? c.leaseDate : c.saleDate;
  return c[key];
}

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
  const [sourceFilter, setSourceFilter] = useState('historical_import');
  const [search, setSearch]         = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]       = useState(DEFAULT_FILTERS);
  const [selected, setSelected]     = useState(new Set());   // Set of comp IDs
  const [assignPropId, setAssignPropId] = useState('');
  const [assigning, setAssigning]   = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingComp, setEditingComp] = useState(null);
  const [sort, setSort]             = useState({ key: null, dir: 'asc' });

  const openAdd  = () => { setEditingComp(null); setModalOpen(true); };
  const openEdit = (c) => { setEditingComp(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingComp(null); };

  const typeFilter   = tab === 'All' ? undefined : tab.toLowerCase();
  const sourceArg    = sourceFilter === 'all' ? undefined : sourceFilter;
  const searchTerm   = search.trim();
  const isSearching  = searchTerm.length > 0;

  // Two paginated sources: browse (indexed by source/type) vs full-text search.
  // Only one is active at a time — the other is skipped.
  const browse = usePaginatedQuery(
    api.comps.getCompsPaginated,
    isSearching ? 'skip' : { type: typeFilter, source: sourceArg },
    { initialNumItems: 50 },
  );
  const searched = usePaginatedQuery(
    api.comps.searchComps,
    isSearching ? { query: searchTerm, type: typeFilter, source: sourceArg } : 'skip',
    { initialNumItems: 50 },
  );
  const active   = isSearching ? searched : browse;
  const comps    = active.results;
  const status   = active.status;          // LoadingFirstPage | CanLoadMore | LoadingMore | Exhausted
  const loadMore = active.loadMore;
  const loadingFirst = status === 'LoadingFirstPage';

  const properties = useQuery(api.properties.getProperties, selected.size > 0 ? {} : 'skip');
  const linkComp   = useMutation(api.comps.linkCompToProperty);

  const activeFilterCount = countActiveFilters(filters);
  const dateCutoff        = getDateCutoff(filters.dateRange);

  // Secondary filters applied to the loaded pages (text search is server-side now).
  const filtered = useMemo(() => {
    return comps.filter(c => {
      if (filters.state && c.state !== filters.state) return false;
      if (filters.assetTypes.length > 0 && !filters.assetTypes.includes(c.assetType)) return false;
      if (dateCutoff) {
        const date = c.type === 'lease' ? c.leaseDate : c.saleDate;
        if (!date || date < dateCutoff) return false;
      }
      if (filters.nlaMin !== 0 || filters.nlaMax !== NLA_MAX) {
        if (!c.nlaSqm) return false;
        if (c.nlaSqm < filters.nlaMin || c.nlaSqm > filters.nlaMax) return false;
      }
      if (filters.landMin !== 0 || filters.landMax !== LAND_MAX) {
        if (!c.landAreaSqm) return false;
        if (c.landAreaSqm < filters.landMin || c.landAreaSqm > filters.landMax) return false;
      }
      return true;
    });
  }, [comps, filters, dateCutoff]);

  // Column sort — applies to the loaded/filtered rows. Empty values sort last
  // regardless of direction; numbers compare numerically, everything else as text.
  const onSort = useCallback((key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' });
  }, []);
  const sortProps = { sort, onSort };

  const visible = useMemo(() => {
    if (!sort.key) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      const aE = va == null || va === '';
      const bE = vb == null || vb === '';
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * dir;
    });
  }, [filtered, sort]);

  // Keep pulling pages while active filters leave too few rows to fill the view —
  // but cap auto-loading at ~1k scanned so a rare filter can't spin forever; past
  // that the user clicks "Load more" explicitly.
  useEffect(() => {
    if (status === 'CanLoadMore' && filtered.length < 30 && comps.length < 1000) loadMore(50);
  }, [status, filtered.length, comps.length, loadMore]);

  // Auto-load the next page when the user scrolls near the bottom.
  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (status === 'CanLoadMore' && el.scrollHeight - el.scrollTop - el.clientHeight < 500) {
      loadMore(50);
    }
  }, [status, loadMore]);

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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/45" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by address…"
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-md pl-9 pr-3 py-2 text-sm text-brand-100/80 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/30 transition-colors"
            />
          </div>

          {/* Source filter — keeps the curated set distinct from the 257k Arealytics archive */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 text-xs font-medium text-brand-100/60 focus:outline-none focus:border-brand-500/40 hover:text-brand-100/80 transition-colors"
            title="Comp source"
          >
            {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

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
          <div className="ml-auto flex items-center gap-3 text-xs text-brand-100/45">
            {selected.size > 0 && (
              <span className="text-brand-400">
                {selected.size} selected
              </span>
            )}
            <span>
              {loadingFirst
                ? 'Loading…'
                : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'comp' : 'comps'} loaded${status === 'Exhausted' ? '' : '+'}`}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto" onScroll={onScroll}>
          {loadingFirst ? (
            <SkeletonTable rows={8} cols={10} />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Database className="w-8 h-8 text-brand-100/10 mb-3" />
              <p className="text-sm text-brand-100/45">
                {isSearching
                  ? `No comps match “${searchTerm}”`
                  : activeFilterCount > 0
                    ? 'No comps match the current filters'
                    : 'No comps yet'}
              </p>
              {!isSearching && activeFilterCount === 0 && (
                <p className="text-xs text-brand-100/40 mt-1">Add one manually or save comps from an IM scan</p>
              )}
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm tabular-nums">
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
                  {tab === 'All' && <Th sortKey="type" {...sortProps}>Type</Th>}
                  <Th sortKey="address" {...sortProps}>Address</Th>
                  <Th sortKey="suburb" {...sortProps}>Suburb</Th>
                  <Th sortKey="postcode" {...sortProps}>Postcode</Th>
                  <Th sortKey="assetType" {...sortProps}>Asset</Th>
                  <Th sortKey="nlaSqm" {...sortProps}>NLA</Th>
                  <Th sortKey="landAreaSqm" {...sortProps}>Land</Th>
                  {tab !== 'Sale'  && <Th sortKey="rentPa" {...sortProps}>Rent/pa</Th>}
                  {tab !== 'Sale'  && <Th sortKey="rentPerSqm" {...sortProps}>$/m²</Th>}
                  {tab !== 'Lease' && <Th sortKey="salePrice" {...sortProps}>Sale price</Th>}
                  {tab !== 'Lease' && <Th sortKey="pricePerSqmBuild" {...sortProps}>$/m² Build</Th>}
                  {tab !== 'Lease' && <Th sortKey="pricePerSqmLand" {...sortProps}>$/m² Land</Th>}
                  {tab === 'Sale'  && <Th sortKey="capRate" {...sortProps}>Cap rate</Th>}
                  <Th sortKey="date" {...sortProps}>Date</Th>
                  <Th sortKey="source" {...sortProps}>Source</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => {
                  const isSelected = selected.has(c._id);
                  return (
                    <motion.tr {...rowEntrance(i)} key={c._id}
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
                      <td className="px-4 py-3 text-brand-100/50">{c.suburb || <Unset />}</td>
                      <td className="px-4 py-3 text-brand-100/40">{c.postcode || <Unset />}</td>
                      <td className="px-4 py-3 text-brand-100/50">{c.assetType ?? <Unset />}</td>
                      <td className="px-4 py-3 text-brand-100/50">
                        {c.nlaSqm ? `${c.nlaSqm.toLocaleString()} sqm` : <Unset />}
                      </td>
                      <td className="px-4 py-3 text-brand-100/50">
                        {c.landAreaSqm ? `${c.landAreaSqm.toLocaleString()} sqm` : <Unset />}
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
                          <td className="px-4 py-3 text-brand-100/50">{c.pricePerSqmLand ? fmtSqm(c.pricePerSqmLand) : <Unset />}</td>
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
                          {c.agentPhone && <Phone className="w-3 h-3 text-brand-100/40" title={`${c.agentName ?? ''} ${c.agentPhone}`} />}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Infinite-scroll footer */}
          {!loadingFirst && filtered.length > 0 && (
            <div className="flex items-center justify-center py-5 text-xs text-brand-100/45">
              {status === 'LoadingMore' ? (
                <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading more…</span>
              ) : status === 'CanLoadMore' ? (
                <button onClick={() => loadMore(50)} className="text-brand-400 hover:text-brand-300 transition-colors">
                  Load more
                </button>
              ) : (
                <span>End of results · {filtered.length.toLocaleString()} shown</span>
              )}
            </div>
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

          <button onClick={clearSelection} className="text-brand-100/45 hover:text-brand-100/60 transition-colors">
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
function Th({ children, sortKey, sort, onSort }) {
  const sortable = !!sortKey && !!onSort;
  const active = sortable && sort?.key === sortKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : (sortable ? 'none' : undefined);
  const content = (
    <span className="inline-flex items-center gap-1">
      {children}
      {active
        ? (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
        : sortable && <ArrowUp className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
    </span>
  );
  return (
    <th
      aria-sort={ariaSort}
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide bg-[#0A0A0A]/50 whitespace-nowrap ${
        active ? 'text-brand-400' : 'text-brand-100/45'
      }`}
    >
      {sortable ? (
        // A real button so the header is keyboard-operable and screen-reader friendly.
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="group inline-flex items-center gap-1 uppercase tracking-wide select-none cursor-pointer hover:text-brand-100/60 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500/50 rounded"
        >
          {content}
        </button>
      ) : content}
    </th>
  );
}

function Unset() {
  return <span className="text-brand-100/40 italic">—</span>;
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
