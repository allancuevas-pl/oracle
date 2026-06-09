import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { toast } from 'sonner';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt$ = (v) => {
  if (v == null) return '—';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'K';
  return '$' + v.toLocaleString();
};
const fmtSqm  = (v) => (v == null ? '—' : `${Math.round(v).toLocaleString()} m²`);
const fmtPsm  = (v) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}/m²`);
const fmtPct  = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);

// ── Sub-section header ─────────────────────────────────────────────────────────
function EvidenceHeader({ title, highlight }) {
  return (
    <tr className={`${highlight ? 'bg-brand-900/30' : 'bg-white/[0.025]'}`}>
      <td
        colSpan={99}
        className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
          highlight ? 'text-brand-500' : 'text-brand-100/50'
        }`}
      >
        {title}
      </td>
    </tr>
  );
}

// ── Comp row actions ───────────────────────────────────────────────────────────
function RemoveBtn({ compId, linkComp }) {
  return (
    <button
      onClick={() =>
        linkComp({ id: compId, linkedPropertyId: undefined }).then(() =>
          toast.success('Removed from Feaso')
        )
      }
      className="text-[10px] text-brand-100/25 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
    >
      ✕
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PropertyAssessmentTab({ property, leasingComps, salesComps, linkComp }) {
  const tenants      = property.tenants || [];
  const currentRent  = tenants.reduce((s, t) => s + (t.netFaceRent || 0), 0);
  const nla          = property.buildingArea;
  const la           = property.landArea;
  const ap           = property.askingPrice;
  const rentPsm      = currentRent > 0 && nla ? Math.round(currentRent / nla) : null;
  const apPsmBuild   = ap && nla ? Math.round(ap / nla) : null;
  const apPsmLand    = ap && la  ? Math.round(ap / la)  : null;
  const impliedYield = currentRent > 0 && ap ? (currentRent / ap) * 100 : null;
  const displayYield = property.estimatedYield ?? impliedYield;

  // Averages from evidence
  const leasingRentPsms  = leasingComps.filter((c) => c.rentPerSqm).map((c) => c.rentPerSqm);
  const avgRentPsm       = leasingRentPsms.length
    ? Math.round(leasingRentPsms.reduce((a, b) => a + b, 0) / leasingRentPsms.length)
    : null;
  const salePsms         = salesComps.filter((c) => c.pricePerSqmBuild).map((c) => c.pricePerSqmBuild);
  const avgSalePsmBuild  = salePsms.length
    ? Math.round(salePsms.reduce((a, b) => a + b, 0) / salePsms.length)
    : null;

  // Shared column headers
  const leaseColHeaders = ['Address', 'NLA (m²)', 'Land (m²)', 'Rent pa', 'Rent/m²', 'Notes', ''];
  const saleColHeaders  = ['Address', 'Build (m²)', 'Land (m²)', 'Price', '$/m² Build', '$/m² Land', 'Date', 'Notes', ''];

  return (
    <div className="space-y-8">

      {/* ══ 1. SUBJECT PROPERTY — always at the top, matching the spreadsheet ══ */}
      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
            Subject Property
          </h3>
          <span className="text-[10px] text-brand-100/30">auto-populated from property record</span>
        </div>
        <div className="rounded-xl border border-brand-800/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-brand-900/20">
                  {[
                    'Address',
                    'NLA (m²)',
                    'Land (m²)',
                    'Rent pa',
                    'Rent/m²',
                    'Asking Price',
                    'Yield',
                    '$/m² Build',
                    '$/m² Land',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-brand-500 border-b border-brand-800/30 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#0A0A0A]">
                  <td className="px-4 py-3 text-sm text-brand-50 font-medium whitespace-nowrap">
                    {property.address}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-200 tabular-nums whitespace-nowrap">
                    {nla ? nla.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-200 tabular-nums whitespace-nowrap">
                    {la ? la.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-200 tabular-nums whitespace-nowrap">
                    {currentRent > 0 ? fmt$(currentRent) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-brand-500 tabular-nums whitespace-nowrap">
                    {rentPsm ? `$${rentPsm}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-200 tabular-nums whitespace-nowrap">
                    {fmt$(ap)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-200 tabular-nums whitespace-nowrap">
                    {displayYield ? fmtPct(displayYield) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-brand-500 tabular-nums whitespace-nowrap">
                    {fmtPsm(apPsmBuild)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-brand-500 tabular-nums whitespace-nowrap">
                    {fmtPsm(apPsmLand)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══ 2. COMPARABLE LEASING EVIDENCE ═════════════════════════════════════ */}
      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
            Comparable Leasing Evidence
          </h3>
          {avgRentPsm && (
            <span className="text-[10px] text-brand-400 bg-brand-900/30 border border-brand-800/40 px-2 py-0.5 rounded-full">
              avg {fmtPsm(avgRentPsm)}
            </span>
          )}
        </div>

        {leasingComps.length === 0 ? (
          <p className="text-xs text-brand-100/25 italic py-3">
            No leasing comps added — go to the Comps tab to add evidence.
          </p>
        ) : (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0A0A0A]">
                    {leaseColHeaders.map((h) => (
                      <th key={h} className="px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-brand-100/30 whitespace-nowrap border-b border-white/[0.04]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* On Market */}
                  {leasingComps.filter((c) => !c.leaseDate).length > 0 && (
                    <>
                      <EvidenceHeader title="On Market" />
                      {leasingComps
                        .filter((c) => !c.leaseDate)
                        .map((comp) => (
                          <LeaseCompRow key={comp._id} comp={comp} linkComp={linkComp} />
                        ))}
                    </>
                  )}
                  {/* Leased */}
                  {leasingComps.filter((c) => !!c.leaseDate).length > 0 && (
                    <>
                      <EvidenceHeader title="Leased" />
                      {leasingComps
                        .filter((c) => !!c.leaseDate)
                        .map((comp) => (
                          <LeaseCompRow key={comp._id} comp={comp} linkComp={linkComp} />
                        ))}
                    </>
                  )}
                  {/* Average row */}
                  {avgRentPsm && (
                    <tr className="bg-white/[0.01] border-t border-white/[0.06]">
                      <td colSpan={3} className="px-4 py-2 text-[10px] text-brand-100/40 font-semibold italic">Average</td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-xs font-bold text-brand-500 tabular-nums italic">
                        ${avgRentPsm}/m²
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ══ 3. COMPARABLE SALES EVIDENCE ═══════════════════════════════════════ */}
      <section>
        <div className="mb-2 flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
            Comparable Sales Evidence
          </h3>
          {avgSalePsmBuild && (
            <span className="text-[10px] text-brand-400 bg-brand-900/30 border border-brand-800/40 px-2 py-0.5 rounded-full">
              avg {fmtPsm(avgSalePsmBuild)} build
            </span>
          )}
        </div>

        {salesComps.length === 0 ? (
          <p className="text-xs text-brand-100/25 italic py-3">
            No sales comps added — go to the Comps tab to add evidence.
          </p>
        ) : (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0A0A0A]">
                    {saleColHeaders.map((h) => (
                      <th key={h} className="px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-brand-100/30 whitespace-nowrap border-b border-white/[0.04]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <EvidenceHeader title="Sold" />
                  {salesComps.map((comp) => (
                    <SaleCompRow key={comp._id} comp={comp} linkComp={linkComp} />
                  ))}
                  {/* Average row */}
                  {avgSalePsmBuild && (
                    <tr className="bg-white/[0.01] border-t border-white/[0.06]">
                      <td colSpan={3} className="px-4 py-2 text-[10px] text-brand-100/40 font-semibold italic">Average</td>
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-xs font-bold text-brand-500 tabular-nums italic">
                        ${avgSalePsmBuild.toLocaleString()}/m²
                      </td>
                      <td colSpan={4} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

// ── Leasing comp row ───────────────────────────────────────────────────────────
function LeaseCompRow({ comp, linkComp }) {
  const rentPsm = comp.rentPerSqm ?? (comp.rentPa && comp.nlaSqm ? Math.round(comp.rentPa / comp.nlaSqm) : null);
  return (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.01] group transition-colors">
      <td className="px-4 py-2.5 text-sm text-brand-50 max-w-[220px] truncate">{comp.address}</td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.nlaSqm ? comp.nlaSqm.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.landAreaSqm ? comp.landAreaSqm.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.rentPa ? `$${Math.round(comp.rentPa).toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">
        {rentPsm ? `$${rentPsm}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-brand-100/35 max-w-[180px] truncate">{comp.notes || ''}</td>
      <td className="px-4 py-2.5 text-right">
        <RemoveBtn compId={comp._id} linkComp={linkComp} />
      </td>
    </tr>
  );
}

// ── Sale comp row ──────────────────────────────────────────────────────────────
function SaleCompRow({ comp, linkComp }) {
  return (
    <tr className="border-t border-white/[0.04] hover:bg-white/[0.01] group transition-colors">
      <td className="px-4 py-2.5 text-sm text-brand-50 max-w-[200px] truncate">{comp.address}</td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.nlaSqm ? comp.nlaSqm.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.landAreaSqm ? comp.landAreaSqm.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.salePrice ? `$${Math.round(comp.salePrice).toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">
        {comp.pricePerSqmBuild ? `$${Math.round(comp.pricePerSqmBuild).toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
        {comp.pricePerSqmLand ? `$${Math.round(comp.pricePerSqmLand).toLocaleString()}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-[11px] text-brand-100/35 whitespace-nowrap">
        {comp.saleDate?.slice(0, 7) || '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-brand-100/35 max-w-[160px] truncate">{comp.notes || ''}</td>
      <td className="px-4 py-2.5 text-right">
        <RemoveBtn compId={comp._id} linkComp={linkComp} />
      </td>
    </tr>
  );
}
