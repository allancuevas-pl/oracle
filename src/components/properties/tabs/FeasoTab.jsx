import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Loader2, Pencil, AlertCircle, TrendingUp, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt$ = (v) => {
  if (v == null) return '—';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'K';
  return '$' + v.toLocaleString();
};
const fmtSqm = (v) => (v == null ? '—' : `${Math.round(v).toLocaleString()} m²`);
const fmtPct = (v) => (v == null ? '—' : `${Number(v).toFixed(2)}%`);
const fmtPsm = (v) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}/m²`);

// ── Inline-editable field ──────────────────────────────────────────────────────
// Renders as a formatted value; click to open an input and save on blur/Enter.
function FeasoField({ label, value, displayValue, unit, suffix, onSave, hint, highlight }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const startEdit = () => {
    setInputVal(value != null ? String(value) : '');
    setEditing(true);
  };

  const commit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n) && n !== value) onSave(n);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const display = displayValue ?? (value != null ? value : null);

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 group">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-xs text-brand-100/45 shrink-0">{label}</span>
        {hint && <span className="text-[10px] text-brand-100/25 truncate">{hint}</span>}
      </div>
      <div className="ml-4 shrink-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              className="w-28 bg-transparent border-b border-brand-500/60 text-sm text-brand-100 text-right focus:outline-none py-0.5 tabular-nums"
              placeholder="0"
            />
            {unit && <span className="text-xs text-brand-100/30">{unit}</span>}
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-sm font-semibold tabular-nums hover:text-brand-400 transition-colors group/btn"
          >
            <span className={highlight ? 'text-brand-500' : (display != null ? 'text-brand-200' : 'text-brand-100/25 italic text-xs font-normal')}>
              {display != null
                ? (suffix ? `${display}${suffix}` : display)
                : 'Click to add'}
            </span>
            {unit && display != null && (
              <span className="text-xs text-brand-100/30">{unit}</span>
            )}
            <Pencil className="w-2.5 h-2.5 text-brand-100/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">{title}</h3>
      {subtitle && <p className="text-xs text-brand-100/35 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Output metric tile ─────────────────────────────────────────────────────────
function OutputTile({ label, value, positive, negative, neutral }) {
  const colorClass = positive ? 'text-emerald-400' : negative ? 'text-red-400' : neutral ? 'text-brand-500' : 'text-brand-50';
  return (
    <div className="flex-1 bg-[#0A0A0A] rounded-xl border border-white/[0.07] px-5 py-4 text-center min-w-[110px]">
      <p className="text-[9px] uppercase tracking-widest text-brand-100/30 mb-1.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${colorClass}`}>
        {value ?? <span className="text-brand-100/20 text-sm font-normal italic">—</span>}
      </p>
    </div>
  );
}

// ── Derived/calculated fields ─────────────────────────────────────────────────
function calcOutputs(property, feaso) {
  if (!feaso) return null;

  const nla = property.buildingArea;
  const tenants = property.tenants || [];
  const currentRent = tenants.reduce((s, t) => s + (t.netFaceRent || 0), 0);

  const offerPrice = feaso.offerPrice ?? property.askingPrice;
  const duration = feaso.projectDurationYears;
  const ltvRatio = feaso.ltvRatio ?? 0.5;
  const loan = offerPrice ? offerPrice * ltvRatio : null;

  // Market rent totals
  const marketRentLowerTotal = feaso.marketRentLow && nla ? feaso.marketRentLow * nla : null;
  const marketRentUpperTotal = feaso.marketRentHigh && nla ? feaso.marketRentHigh * nla : null;

  // Adopted cap rate → new value
  const adoptedCapRate = feaso.adoptedCapRate;
  const newValue =
    marketRentLowerTotal && adoptedCapRate && adoptedCapRate > 0
      ? marketRentLowerTotal / (adoptedCapRate / 100)
      : null;

  // Acquisition costs
  const stampDuty = offerPrice && feaso.stampDutyPct != null
    ? offerPrice * (feaso.stampDutyPct / 100)
    : null;
  const closingCosts = feaso.closingCosts ?? null;
  const baFee = offerPrice && feaso.baFeePct ? offerPrice * (feaso.baFeePct / 100) : null;
  const totalAcquisition =
    offerPrice && stampDuty != null && closingCosts != null && baFee != null
      ? offerPrice + stampDuty + closingCosts + baFee
      : offerPrice
        ? offerPrice + (stampDuty ?? 0) + (closingCosts ?? 0) + (baFee ?? 0)
        : null;

  // Project costs
  const leasingCosts = marketRentLowerTotal && feaso.leasingCostsPct
    ? marketRentLowerTotal * (feaso.leasingCostsPct / 100)
    : null;
  const incentives =
    marketRentLowerTotal && feaso.incentivesPct && feaso.incentiveTermYears
      ? marketRentLowerTotal * (feaso.incentivesPct / 100) * feaso.incentiveTermYears
      : null;
  const interest =
    loan && feaso.interestRatePct && duration
      ? loan * (feaso.interestRatePct / 100) * duration
      : null;
  const vacancyCost =
    currentRent > 0 && feaso.vacancyMonths
      ? (currentRent / 12) * feaso.vacancyMonths
      : null;
  const rentIncome = currentRent > 0 && duration ? currentRent * duration : null;
  const works = feaso.works ?? null;

  const totalProjectCosts =
    (leasingCosts ?? 0) +
    (incentives ?? 0) +
    (interest ?? 0) +
    (works ?? 0) +
    (vacancyCost ?? 0) -
    (rentIncome ?? 0);

  const totalCosts = totalAcquisition != null ? totalAcquisition + totalProjectCosts : null;

  const netProfit = newValue != null && totalCosts != null ? newValue - totalCosts : null;
  const profitMargin = newValue && netProfit != null ? netProfit / newValue : null;
  const equity = totalCosts != null && loan != null ? totalCosts - loan : null;
  const roi = netProfit != null && equity && equity > 0 ? netProfit / equity : null;
  const irr = roi != null && duration && duration > 0 ? roi / duration : null;

  return {
    // Acquisition
    stampDuty, closingCosts, baFee, totalAcquisition, loan,
    // Project
    leasingCosts, incentives, interest, vacancyCost, rentIncome, works,
    totalProjectCosts,
    // Totals
    totalCosts, newValue, netProfit, profitMargin, equity, roi, irr,
    // Market rent
    marketRentLowerTotal, marketRentUpperTotal,
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export function FeasoTab({ property }) {
  const upsertFeaso = useMutation(api.feasos.upsertFeaso);
  const linkComp = useMutation(api.comps.linkCompToProperty);

  const feasoData = useQuery(api.feasos.getFeasoForProperty, { propertyId: property._id });
  const linkedComps = useQuery(api.comps.getCompsByProperty, { propertyId: property._id });

  const save = (updates) => {
    upsertFeaso({ propertyId: property._id, ...updates }).catch(() =>
      toast.error('Failed to save')
    );
  };

  if (feasoData === undefined || linkedComps === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[380px]">
        <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
      </div>
    );
  }

  const feaso = feasoData;
  const leasingComps = (linkedComps || []).filter((c) => c.type === 'lease');
  const salesComps = (linkedComps || []).filter((c) => c.type === 'sale');

  // Subject property metrics
  const tenants = property.tenants || [];
  const currentRent = tenants.reduce((s, t) => s + (t.netFaceRent || 0), 0);
  const nla = property.buildingArea;
  const la = property.landArea;
  const ap = feaso?.offerPrice ?? property.askingPrice;
  const rentPsm = currentRent > 0 && nla ? Math.round(currentRent / nla) : null;
  const apPsmBuild = ap && nla ? Math.round(ap / nla) : null;
  const apPsmLand = ap && la ? Math.round(ap / la) : null;
  const impliedYield = currentRent > 0 && ap ? ((currentRent / ap) * 100).toFixed(2) : null;

  // Outputs
  const out = calcOutputs(property, feaso);

  // Leasing averages for reference
  const leasingRentPsms = leasingComps.filter((c) => c.rentPerSqm).map((c) => c.rentPerSqm);
  const avgRentPsm = leasingRentPsms.length
    ? Math.round(leasingRentPsms.reduce((a, b) => a + b, 0) / leasingRentPsms.length)
    : null;

  // Sales averages
  const salePsms = salesComps.filter((c) => c.pricePerSqmBuild).map((c) => c.pricePerSqmBuild);
  const avgSalePsmBuild = salePsms.length
    ? Math.round(salePsms.reduce((a, b) => a + b, 0) / salePsms.length)
    : null;

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ══════════════════ SECTION 1: EVIDENCE ══════════════════════════════ */}
      <section>
        <SectionHeader
          title="Evidence"
          subtitle="Comparable leasing and sales data added from the Comps tab"
        />

        {/* Leasing Evidence */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs font-semibold text-brand-100/50 uppercase tracking-wider">Leasing Evidence</p>
            {avgRentPsm && (
              <span className="text-[10px] text-brand-400 bg-brand-900/30 border border-brand-800/40 px-2 py-0.5 rounded-full">
                avg {fmtPsm(avgRentPsm)}
              </span>
            )}
          </div>
          {leasingComps.length === 0 ? (
            <p className="text-xs text-brand-100/25 py-4 italic">
              No leasing comps added — go to the Comps tab to add evidence.
            </p>
          ) : (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#0A0A0A]">
                      {['Address', 'NLA', 'Rent pa', 'Rent/m²', 'Notes', ''].map((h) => (
                        <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-brand-100/30 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leasingComps.map((comp) => (
                      <tr key={comp._id} className="border-t border-white/[0.04] hover:bg-white/[0.01] group">
                        <td className="px-4 py-2.5 text-sm text-brand-50 font-medium max-w-[220px] truncate">{comp.address}</td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">{fmtSqm(comp.nlaSqm)}</td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">{fmt$(comp.rentPa)}</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">
                          {fmtPsm(comp.rentPerSqm ?? (comp.rentPa && comp.nlaSqm ? Math.round(comp.rentPa / comp.nlaSqm) : null))}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-brand-100/35 max-w-[200px] truncate">{comp.notes || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => linkComp({ id: comp._id, linkedPropertyId: undefined }).then(() => toast.success('Removed from Feaso'))}
                            className="text-[11px] text-brand-100/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sales Evidence */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs font-semibold text-brand-100/50 uppercase tracking-wider">Sales Evidence</p>
            {avgSalePsmBuild && (
              <span className="text-[10px] text-brand-400 bg-brand-900/30 border border-brand-800/40 px-2 py-0.5 rounded-full">
                avg {fmtPsm(avgSalePsmBuild)} build
              </span>
            )}
          </div>
          {salesComps.length === 0 ? (
            <p className="text-xs text-brand-100/25 py-4 italic">
              No sales comps added — go to the Comps tab to add evidence.
            </p>
          ) : (
            <div className="rounded-lg border border-white/[0.06] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#0A0A0A]">
                      {['Address', 'Build', 'Land', 'Price', '$/m² Build', '$/m² Land', 'Cap Rate', 'Date', ''].map((h) => (
                        <th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-brand-100/30 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesComps.map((comp) => (
                      <tr key={comp._id} className="border-t border-white/[0.04] hover:bg-white/[0.01] group">
                        <td className="px-4 py-2.5 text-sm text-brand-50 font-medium max-w-[200px] truncate">{comp.address}</td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">{fmtSqm(comp.nlaSqm)}</td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">{fmtSqm(comp.landAreaSqm)}</td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">{fmt$(comp.salePrice)}</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">
                          {comp.pricePerSqmBuild ? `$${Math.round(comp.pricePerSqmBuild).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
                          {comp.pricePerSqmLand ? `$${Math.round(comp.pricePerSqmLand).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
                          {comp.capRate ? fmtPct(comp.capRate * 100) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-brand-100/35 whitespace-nowrap">
                          {comp.saleDate?.slice(0, 7) || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => linkComp({ id: comp._id, linkedPropertyId: undefined }).then(() => toast.success('Removed from Feaso'))}
                            className="text-[11px] text-brand-100/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════ SECTION 2: SUBJECT PROPERTY ═══════════════════════ */}
      <section>
        <SectionHeader
          title="Subject Property"
          subtitle="Auto-populated from property record — edit on the Details tab"
        />
        <div className="rounded-xl border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02]">
                  {['NLA', 'Land', 'Rent pa', 'Rent/m²', 'Asking Price', 'Yield', '$/m² (Build)', '$/m² (Land)'].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-500 border-b border-white/[0.06] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-100 tabular-nums whitespace-nowrap">{fmtSqm(nla)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-100 tabular-nums whitespace-nowrap">{fmtSqm(la)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-100 tabular-nums whitespace-nowrap">{currentRent > 0 ? fmt$(currentRent) : '—'}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">{fmtPsm(rentPsm)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-100 tabular-nums whitespace-nowrap">{fmt$(property.askingPrice)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-100 tabular-nums whitespace-nowrap">
                    {property.estimatedYield ? fmtPct(property.estimatedYield) : impliedYield ? `${impliedYield}%` : '—'}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">{fmtPsm(apPsmBuild)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-brand-500 tabular-nums whitespace-nowrap">{fmtPsm(apPsmLand)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ══════════════════ SECTION 3 + 4: ANALYST INPUTS ════════════════════ */}
      <section>
        <SectionHeader
          title="Project Feasibility"
          subtitle="Analyst inputs — click any value to edit. Outputs auto-calculate below."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: Market Benchmarks + Acquisition */}
          <div className="space-y-5">

            {/* Market benchmarks */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/50">Market Benchmarks</p>
              </div>
              <div className="px-4 py-1">
                <FeasoField
                  label="Market rent — low"
                  value={feaso?.marketRentLow}
                  displayValue={feaso?.marketRentLow ? `$${feaso.marketRentLow}/m²` : null}
                  onSave={(n) => save({ marketRentLow: n })}
                  hint={avgRentPsm ? `avg comps $${avgRentPsm}/m²` : undefined}
                />
                <FeasoField
                  label="Market rent — high"
                  value={feaso?.marketRentHigh}
                  displayValue={feaso?.marketRentHigh ? `$${feaso.marketRentHigh}/m²` : null}
                  onSave={(n) => save({ marketRentHigh: n })}
                />
                <FeasoField
                  label="Sale $/m² build — low"
                  value={feaso?.salePricePerSqmBuildLow}
                  displayValue={fmtPsm(feaso?.salePricePerSqmBuildLow)}
                  onSave={(n) => save({ salePricePerSqmBuildLow: n })}
                  hint={avgSalePsmBuild ? `avg comps $${avgSalePsmBuild}/m²` : undefined}
                />
                <FeasoField
                  label="Sale $/m² build — high"
                  value={feaso?.salePricePerSqmBuildHigh}
                  displayValue={fmtPsm(feaso?.salePricePerSqmBuildHigh)}
                  onSave={(n) => save({ salePricePerSqmBuildHigh: n })}
                />
                <FeasoField
                  label="Adopted cap rate"
                  value={feaso?.adoptedCapRate}
                  displayValue={feaso?.adoptedCapRate ? `${feaso.adoptedCapRate}%` : null}
                  onSave={(n) => save({ adoptedCapRate: n })}
                  highlight
                />
              </div>
            </div>

            {/* Acquisition costs */}
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/50">Acquisition</p>
              </div>
              <div className="px-4 py-1">
                <FeasoField
                  label="Offer price"
                  value={feaso?.offerPrice ?? property.askingPrice}
                  displayValue={fmt$(feaso?.offerPrice ?? property.askingPrice)}
                  onSave={(n) => save({ offerPrice: n })}
                  hint={!feaso?.offerPrice ? 'from asking price' : undefined}
                  highlight
                />
                <FeasoField
                  label="Project duration"
                  value={feaso?.projectDurationYears}
                  displayValue={feaso?.projectDurationYears ? `${feaso.projectDurationYears} yrs` : null}
                  onSave={(n) => save({ projectDurationYears: n })}
                />
                <FeasoField
                  label="Stamp duty"
                  value={feaso?.stampDutyPct ?? 0}
                  displayValue={`${feaso?.stampDutyPct ?? 0}%${out?.stampDuty ? ` (${fmt$(out.stampDuty)})` : ''}`}
                  onSave={(n) => save({ stampDutyPct: n })}
                  hint="0% SA via scheme"
                />
                <FeasoField
                  label="Closing costs"
                  value={feaso?.closingCosts}
                  displayValue={fmt$(feaso?.closingCosts)}
                  onSave={(n) => save({ closingCosts: n })}
                />
                <FeasoField
                  label="BA fee"
                  value={feaso?.baFeePct ?? 2.5}
                  displayValue={`${feaso?.baFeePct ?? 2.5}%${out?.baFee ? ` (${fmt$(out.baFee)})` : ''}`}
                  onSave={(n) => save({ baFeePct: n })}
                />
                {out?.totalAcquisition != null && (
                  <div className="flex items-center justify-between py-2.5 mt-1 border-t border-white/[0.06]">
                    <span className="text-xs font-semibold text-brand-100/60">Total Acquisition</span>
                    <span className="text-sm font-bold text-brand-200 tabular-nums">{fmt$(out.totalAcquisition)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Project Costs */}
          <div className="rounded-xl border border-white/[0.07] overflow-hidden h-fit">
            <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/50">Project Costs</p>
            </div>
            <div className="px-4 py-1">
              <FeasoField
                label="LTV ratio"
                value={feaso?.ltvRatio ?? 0.5}
                displayValue={`${((feaso?.ltvRatio ?? 0.5) * 100).toFixed(0)}%${out?.loan ? ` (loan ${fmt$(out.loan)})` : ''}`}
                onSave={(n) => save({ ltvRatio: n > 1 ? n / 100 : n })}
              />
              <FeasoField
                label="Interest rate"
                value={feaso?.interestRatePct ?? 6.5}
                displayValue={`${feaso?.interestRatePct ?? 6.5}% IO${out?.interest ? ` (${fmt$(out.interest)})` : ''}`}
                onSave={(n) => save({ interestRatePct: n })}
              />
              <FeasoField
                label="Leasing costs"
                value={feaso?.leasingCostsPct ?? 11}
                displayValue={`${feaso?.leasingCostsPct ?? 11}%${out?.leasingCosts ? ` (${fmt$(out.leasingCosts)})` : ''}`}
                onSave={(n) => save({ leasingCostsPct: n })}
                hint="% of market rent"
              />
              <FeasoField
                label="Incentives"
                value={feaso?.incentivesPct ?? 15}
                displayValue={`${feaso?.incentivesPct ?? 15}%${feaso?.incentiveTermYears ? ` · ${feaso.incentiveTermYears}yr term` : ''}${out?.incentives ? ` (${fmt$(out.incentives)})` : ''}`}
                onSave={(n) => save({ incentivesPct: n })}
                hint="% on lease term"
              />
              <FeasoField
                label="Incentive term"
                value={feaso?.incentiveTermYears ?? 5}
                displayValue={`${feaso?.incentiveTermYears ?? 5} yrs`}
                onSave={(n) => save({ incentiveTermYears: n })}
              />
              <FeasoField
                label="Works / makegood"
                value={feaso?.works}
                displayValue={fmt$(feaso?.works)}
                onSave={(n) => save({ works: n })}
              />
              <FeasoField
                label="Vacancy allowance"
                value={feaso?.vacancyMonths ?? 3}
                displayValue={`${feaso?.vacancyMonths ?? 3} mths${out?.vacancyCost ? ` (${fmt$(out.vacancyCost)})` : ''}`}
                onSave={(n) => save({ vacancyMonths: n })}
              />
              {out?.rentIncome != null && (
                <FeasoField
                  label="Rental income received"
                  value={null}
                  displayValue={`(${fmt$(out.rentIncome)})`}
                  onSave={() => {}}
                  hint="during project — deducted"
                />
              )}
              {out?.totalProjectCosts != null && (
                <div className="flex items-center justify-between py-2.5 mt-1 border-t border-white/[0.06]">
                  <span className="text-xs font-semibold text-brand-100/60">Total Project Costs</span>
                  <span className="text-sm font-bold text-brand-200 tabular-nums">{fmt$(out.totalProjectCosts)}</span>
                </div>
              )}
              {out?.totalCosts != null && (
                <div className="flex items-center justify-between py-2.5 border-t border-white/[0.06]">
                  <span className="text-xs font-bold text-brand-100/80">Total Costs</span>
                  <span className="text-sm font-bold text-white tabular-nums">{fmt$(out.totalCosts)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ SECTION 5: ANALYSIS OUTPUTS ══════════════════════ */}
      {out && (
        <section>
          <SectionHeader
            title="Analysis Outputs"
            subtitle="Calculated from inputs above — update market benchmarks or offer price to see changes"
          />

          {(!feaso?.adoptedCapRate || !feaso?.marketRentLow) && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-900/10 border border-amber-700/20 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400/80 leading-relaxed">
                Set <strong className="text-amber-400">market rent low</strong> and{' '}
                <strong className="text-amber-400">adopted cap rate</strong> to calculate new property value.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <OutputTile
              label="New Value"
              value={out.newValue ? fmt$(out.newValue) : null}
              neutral
            />
            <OutputTile
              label="Net Profit"
              value={out.netProfit != null ? fmt$(out.netProfit) : null}
              positive={out.netProfit > 0}
              negative={out.netProfit < 0}
            />
            <OutputTile
              label="Profit Margin"
              value={out.profitMargin != null ? `${(out.profitMargin * 100).toFixed(1)}%` : null}
              positive={out.profitMargin > 0.15}
              negative={out.profitMargin < 0}
            />
            <OutputTile
              label="ROI"
              value={out.roi != null ? `${(out.roi * 100).toFixed(1)}%` : null}
              positive={out.roi > 0.3}
              negative={out.roi < 0}
            />
            <OutputTile
              label="IRR"
              value={out.irr != null ? `${(out.irr * 100).toFixed(1)}%` : null}
              positive={out.irr > 0.15}
              negative={out.irr < 0}
            />
          </div>

          {out.newValue && out.totalCosts && (
            <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-brand-100/35 mb-1">New Value $/m² (Build)</p>
                  <p className="text-brand-200 font-semibold tabular-nums">
                    {nla ? `$${Math.round(out.newValue / nla).toLocaleString()}/m²` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-brand-100/35 mb-1">New Value $/m² (Land)</p>
                  <p className="text-brand-200 font-semibold tabular-nums">
                    {la ? `$${Math.round(out.newValue / la).toLocaleString()}/m²` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-brand-100/35 mb-1">Equity Invested</p>
                  <p className="text-brand-200 font-semibold tabular-nums">{fmt$(out.equity)}</p>
                </div>
                <div>
                  <p className="text-brand-100/35 mb-1">Debt</p>
                  <p className="text-brand-200 font-semibold tabular-nums">{fmt$(out.loan)}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  );
}
