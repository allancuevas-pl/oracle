import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import {
  CheckCircle2, Plus, Search, TrendingUp, Building2, Loader2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatCurrency } from '../../../utils/format';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtSqm = (v) => (v == null ? '—' : `${Math.round(v).toLocaleString()} m²`);
const fmtPct = (v) => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
        {title}
      </h3>
      {count != null && (
        <span className="text-[10px] font-bold text-brand-400 bg-brand-900/30 border border-brand-800/40 px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

function CompTag({ label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-900/20 border border-emerald-700/30 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-2.5 h-2.5" /> In Feaso
    </span>
  );
}

/** Audit trail line: "Added D Mon YY by Name · Updated D Mon YY by Name" + verified badge. */
function CompMeta({ comp, memberMap }) {
  const name = (clerkId) => {
    if (!clerkId) return null;
    return memberMap?.[clerkId] || null;
  };
  const addedDate  = comp._creationTime ? formatDate(comp._creationTime) : null;
  const addedBy    = name(comp.createdBy);
  const updatedDate = comp.updatedAt ? formatDate(comp.updatedAt) : null;
  const updatedBy  = name(comp.updatedBy);

  if (!addedDate && !comp.verified) return null;

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {addedDate && (
        <span className="text-[10px] text-brand-100/40">
          Added {addedDate}{addedBy ? ` by ${addedBy}` : ''}
        </span>
      )}
      {updatedDate && (
        <span className="text-[10px] text-brand-100/40">
          · Edited {updatedDate}{updatedBy ? ` by ${updatedBy}` : ''}
        </span>
      )}
      {comp.verified && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400/60">
          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
        </span>
      )}
    </div>
  );
}

function LeaseCompRow({ comp, isLinked, propertyId, onLink, memberMap }) {
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    setLoading(true);
    try {
      await onLink({ id: comp._id, linkedPropertyId: isLinked ? undefined : propertyId });
      toast.success(isLinked ? 'Removed from Feaso' : 'Added to Feaso');
    } catch {
      toast.error('Failed to update comp');
    } finally {
      setLoading(false);
    }
  };

  const rentPsm = comp.rentPerSqm ?? (comp.rentPa && comp.nlaSqm ? Math.round(comp.rentPa / comp.nlaSqm) : null);

  return (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors group">
      <td className="py-2.5 pr-4 max-w-0">
        <p className="text-sm text-brand-50 font-medium truncate">{comp.address}</p>
        {comp.leaseTerm && (
          <span className="inline-block text-[10px] font-medium text-brand-400/60 bg-brand-900/20 border border-brand-800/30 px-1.5 py-0.5 rounded mt-0.5 mr-1">{comp.leaseTerm}</span>
        )}
        {comp.incentives && (
          <p className="text-[11px] text-amber-400/60 truncate mt-0.5">Incentives: {comp.incentives}</p>
        )}
        {comp.notes && (
          <p className="text-[11px] text-brand-100/35 truncate mt-0.5">{comp.notes}</p>
        )}
        <CompMeta comp={comp} memberMap={memberMap} />
      </td>
      <td className="py-2.5 pr-4 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {fmtSqm(comp.nlaSqm)}
      </td>
      <td className="py-2.5 pr-4 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {formatCurrency(comp.rentPa)}<span className="text-brand-100/45 text-[11px]">/pa</span>
      </td>
      <td className="py-2.5 pr-4 text-sm font-semibold tabular-nums whitespace-nowrap">
        <span className={rentPsm ? 'text-brand-500' : 'text-brand-100/45'}>
          {rentPsm ? `$${rentPsm}/m²` : '—'}
        </span>
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        {comp.leaseDate
          ? <span className="text-[11px] text-brand-100/40">{comp.leaseDate.slice(0, 7)}</span>
          : <span className="text-brand-100/40">—</span>}
      </td>
      <td className="py-2.5 pl-2 text-right whitespace-nowrap">
        {isLinked ? (
          <button
            onClick={handleLink}
            disabled={loading}
            className="text-[11px] font-medium text-brand-100/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Remove'}
          </button>
        ) : (
          <button
            onClick={handleLink}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-300 border border-brand-700/40 hover:border-brand-500/60 px-2.5 py-1 rounded transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add to Feaso
          </button>
        )}
      </td>
    </tr>
  );
}

function SaleCompRow({ comp, isLinked, propertyId, onLink, memberMap }) {
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    setLoading(true);
    try {
      await onLink({ id: comp._id, linkedPropertyId: isLinked ? undefined : propertyId });
      toast.success(isLinked ? 'Removed from Feaso' : 'Added to Feaso');
    } catch {
      toast.error('Failed to update comp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors group">
      <td className="py-2.5 pr-4 max-w-0">
        <p className="text-sm text-brand-50 font-medium truncate">{comp.address}</p>
        {comp.notes && (
          <p className="text-[11px] text-brand-100/35 truncate mt-0.5">{comp.notes}</p>
        )}
        <CompMeta comp={comp} memberMap={memberMap} />
      </td>
      <td className="py-2.5 pr-4 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {fmtSqm(comp.nlaSqm)}
      </td>
      <td className="py-2.5 pr-4 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {fmtSqm(comp.landAreaSqm)}
      </td>
      <td className="py-2.5 pr-4 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {formatCurrency(comp.salePrice)}
      </td>
      <td className="py-2.5 pr-4 text-sm font-semibold tabular-nums whitespace-nowrap">
        <span className={comp.pricePerSqmBuild ? 'text-brand-500' : 'text-brand-100/45'}>
          {comp.pricePerSqmBuild ? `$${Math.round(comp.pricePerSqmBuild).toLocaleString()}` : '—'}
        </span>
      </td>
      <td className="py-2.5 pr-4 text-sm tabular-nums whitespace-nowrap text-brand-300">
        {comp.pricePerSqmLand ? `$${Math.round(comp.pricePerSqmLand).toLocaleString()}` : '—'}
      </td>
      <td className="py-2.5 pr-4 text-sm tabular-nums whitespace-nowrap text-brand-300">
        {comp.capRate ? fmtPct(comp.capRate) : '—'}
      </td>
      <td className="py-2.5 pr-4 whitespace-nowrap">
        {comp.saleDate
          ? <span className="text-[11px] text-brand-100/40">{comp.saleDate.slice(0, 7)}</span>
          : <span className="text-brand-100/40">—</span>}
      </td>
      <td className="py-2.5 pl-2 text-right whitespace-nowrap">
        {isLinked ? (
          <button
            onClick={handleLink}
            disabled={loading}
            className="text-[11px] font-medium text-brand-100/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Remove'}
          </button>
        ) : (
          <button
            onClick={handleLink}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:text-brand-300 border border-brand-700/40 hover:border-brand-500/60 px-2.5 py-1 rounded transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add to Feaso
          </button>
        )}
      </td>
    </tr>
  );
}

function EmptyState({ type }) {
  return (
    <div className="py-10 text-center border border-white/[0.05] rounded-lg bg-white/[0.01]">
      <TrendingUp className="w-6 h-6 text-brand-100/15 mx-auto mb-2" />
      <p className="text-sm text-brand-100/45 font-medium">No {type} comps found</p>
      <p className="text-xs text-brand-100/40 mt-1">
        Comps matching this suburb and asset type will appear here.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function CompsTab({ property }) {
  const [search, setSearch] = useState('');

  const linkComp = useMutation(api.comps.linkCompToProperty);

  // Team members — for audit trail name resolution
  const teamMembers = useQuery(api.team.getTeamMembers);
  const memberMap = useMemo(() => {
    if (!teamMembers) return {};
    return Object.fromEntries(
      teamMembers.map((m) => [
        m.clerkId,
        [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Team member',
      ])
    );
  }, [teamMembers]);

  // All recommended comps for this suburb + assetType (both lease + sale)
  const allLeaseComps = useQuery(
    api.comps.getComps,
    property.suburb
      ? { suburb: property.suburb, assetType: property.assetType, type: 'lease' }
      : 'skip'
  );
  const allSaleComps = useQuery(
    api.comps.getComps,
    property.suburb
      ? { suburb: property.suburb, assetType: property.assetType, type: 'sale' }
      : 'skip'
  );

  // Comps already linked to this property
  const linkedComps = useQuery(api.comps.getCompsByProperty, { propertyId: property._id });

  const linkedIds = useMemo(
    () => new Set((linkedComps || []).map((c) => c._id)),
    [linkedComps]
  );

  // Filter by search
  const filterComps = (comps) =>
    (comps || []).filter((c) =>
      !search || c.address.toLowerCase().includes(search.toLowerCase())
    );

  const leaseComps = filterComps(allLeaseComps);
  const saleComps = filterComps(allSaleComps);

  const linkedLeaseComps = filterComps(linkedComps?.filter((c) => c.type === 'lease') || []);
  const linkedSaleComps = filterComps(linkedComps?.filter((c) => c.type === 'sale') || []);

  // Recommended = not yet linked to this property
  const recommendedLeaseComps = leaseComps.filter((c) => !linkedIds.has(c._id));
  const recommendedSaleComps = saleComps.filter((c) => !linkedIds.has(c._id));

  const totalLinked = (linkedComps || []).length;

  if (!property.suburb) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] max-w-sm mx-auto text-center">
        <div className="w-14 h-14 rounded-xl bg-brand-900/30 border border-brand-800/40 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-brand-500/50" />
        </div>
        <h3 className="text-base font-semibold text-brand-50 mb-2">No suburb set</h3>
        <p className="text-sm text-brand-100/40 leading-relaxed">
          Add a suburb to this property on the Details tab to see comparable evidence.
        </p>
      </div>
    );
  }

  const isLoading = allLeaseComps === undefined || allSaleComps === undefined || linkedComps === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[380px]">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-brand-50">Comparable Evidence</h2>
          <p className="text-sm text-brand-100/40 mt-0.5">
            {property.suburb} · {property.assetType} ·{' '}
            <span className="text-emerald-400 font-medium">{totalLinked} added to Feaso</span>
          </p>
        </div>
        {/* Search */}
        <div className="relative w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-100/45" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by address…"
            className="w-full bg-[#111] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-sm text-brand-50 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Info banner if comps already added */}
      {totalLinked > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-emerald-900/10 border border-emerald-700/20">
          <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-400/80 leading-relaxed">
            {totalLinked} comp{totalLinked !== 1 ? 's' : ''} added to this Feaso. Switch to the{' '}
            <strong className="text-emerald-400">Feaso tab</strong> to see the full analysis.
          </p>
        </div>
      )}

      {/* ── Leasing Evidence ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Leasing Evidence"
          count={(linkedLeaseComps.length + recommendedLeaseComps.length) || undefined}
        />
        {linkedLeaseComps.length === 0 && recommendedLeaseComps.length === 0 ? (
          <EmptyState type="leasing" />
        ) : (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0A0A0A]">
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 min-w-[200px]">Address</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">NLA</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Rent pa</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Rent/m²</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Already linked comps first */}
                  {linkedLeaseComps.map((comp) => (
                    <LeaseCompRow
                      key={comp._id}
                      comp={comp}
                      isLinked={true}
                      propertyId={property._id}
                      onLink={linkComp}
                      memberMap={memberMap}
                    />
                  ))}
                  {/* Recommended (not yet linked) */}
                  {recommendedLeaseComps.map((comp) => (
                    <LeaseCompRow
                      key={comp._id}
                      comp={comp}
                      isLinked={false}
                      propertyId={property._id}
                      onLink={linkComp}
                      memberMap={memberMap}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {/* Linked count row */}
            {linkedLeaseComps.length > 0 && (
              <div className="px-4 py-2 bg-emerald-900/10 border-t border-emerald-800/20 text-[11px] text-emerald-400/70">
                {linkedLeaseComps.length} of {linkedLeaseComps.length + recommendedLeaseComps.length} added to Feaso
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Sales Evidence ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          title="Sales Evidence"
          count={(linkedSaleComps.length + recommendedSaleComps.length) || undefined}
        />
        {linkedSaleComps.length === 0 && recommendedSaleComps.length === 0 ? (
          <EmptyState type="sales" />
        ) : (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0A0A0A]">
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 min-w-[200px]">Address</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Build</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Land</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Price</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">$/m² Build</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">$/m² Land</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Cap Rate</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedSaleComps.map((comp) => (
                    <SaleCompRow
                      key={comp._id}
                      comp={comp}
                      isLinked={true}
                      propertyId={property._id}
                      onLink={linkComp}
                      memberMap={memberMap}
                    />
                  ))}
                  {recommendedSaleComps.map((comp) => (
                    <SaleCompRow
                      key={comp._id}
                      comp={comp}
                      isLinked={false}
                      propertyId={property._id}
                      onLink={linkComp}
                      memberMap={memberMap}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {linkedSaleComps.length > 0 && (
              <div className="px-4 py-2 bg-emerald-900/10 border-t border-emerald-800/20 text-[11px] text-emerald-400/70">
                {linkedSaleComps.length} of {linkedSaleComps.length + recommendedSaleComps.length} added to Feaso
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
}
