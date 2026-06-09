import React, { useState, useRef, useEffect } from 'react';
import { Pencil, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmt$ = (v) => {
  if (v == null) return '—';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'K';
  return '$' + v.toLocaleString();
};
const fmtRaw = (v) => (v == null ? '—' : `$${Math.round(v).toLocaleString()}`);
const fmtPct = (v, dec = 2) => (v == null ? '—' : `${Number(v).toFixed(dec)}%`);

// ── Inline-editable field ──────────────────────────────────────────────────────
function FeasoField({ label, rawValue, displayValue, unit, hint, onSave, highlight, readOnly }) {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef                = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const startEdit = () => {
    if (readOnly) return;
    setInputVal(rawValue != null ? String(rawValue) : '');
    setEditing(true);
  };

  const commit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n) && n !== rawValue) onSave(n);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 group">
      <div className="flex items-baseline gap-2 min-w-0 shrink-0 mr-4">
        <span className="text-xs text-brand-100/45">{label}</span>
        {hint && <span className="text-[10px] text-brand-100/25">{hint}</span>}
      </div>
      <div className="shrink-0">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') cancel();
              }}
              className="w-28 bg-transparent border-b border-brand-500/60 text-sm text-brand-100 text-right focus:outline-none py-0.5 tabular-nums"
              placeholder="0"
            />
            {unit && <span className="text-xs text-brand-100/30">{unit}</span>}
          </div>
        ) : (
          <button
            onClick={startEdit}
            disabled={readOnly}
            className="flex items-center gap-1.5 group/btn"
          >
            <span
              className={`text-sm font-semibold tabular-nums ${
                highlight          ? 'text-brand-500' :
                displayValue != null ? 'text-brand-200' :
                readOnly           ? 'text-brand-100/30 text-xs font-normal' :
                                     'text-brand-100/30 italic text-xs font-normal'
              }`}
            >
              {displayValue ?? (readOnly ? '—' : 'Click to add')}
            </span>
            {!readOnly && (
              <Pencil className="w-2.5 h-2.5 text-brand-100/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Cost line (label | calculated $ | editable override) ──────────────────────
function CostLine({ label, calculatedValue, hint }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-brand-100/45">{label}</span>
        {hint && <span className="text-[10px] text-brand-100/25">{hint}</span>}
      </div>
      <span className={`text-sm tabular-nums ${calculatedValue != null ? 'text-brand-200 font-semibold' : 'text-brand-100/25 italic text-xs font-normal'}`}>
        {calculatedValue != null ? fmtRaw(calculatedValue) : '—'}
      </span>
    </div>
  );
}

// ── Total line ─────────────────────────────────────────────────────────────────
function TotalLine({ label, value, highlight }) {
  return (
    <div className={`flex items-center justify-between py-2.5 mt-1 border-t ${highlight ? 'border-brand-700/30' : 'border-white/[0.06]'}`}>
      <span className={`text-xs font-bold ${highlight ? 'text-brand-400' : 'text-brand-100/70'}`}>{label}</span>
      <span className={`text-sm font-bold tabular-nums ${highlight ? 'text-brand-400' : 'text-brand-200'}`}>
        {value != null ? fmtRaw(value) : '—'}
      </span>
    </div>
  );
}

// ── Output tile ────────────────────────────────────────────────────────────────
function OutputTile({ label, value, positive, negative, neutral }) {
  const colorClass =
    positive ? 'text-emerald-400' :
    negative ? 'text-red-400' :
    neutral  ? 'text-brand-500' :
               'text-brand-50';
  return (
    <div className="flex-1 bg-[#0A0A0A] rounded-xl border border-white/[0.07] px-5 py-4 text-center min-w-[100px]">
      <p className="text-[9px] uppercase tracking-widest text-brand-100/30 mb-1.5">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${colorClass}`}>
        {value ?? <span className="text-brand-100/20 text-sm font-normal italic">—</span>}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ProjectFeasibilityTab({ property, feaso, save }) {
  const tenants     = property.tenants || [];
  const nla         = property.buildingArea;
  const la          = property.landArea;
  const currentRent = tenants.reduce((s, t) => s + (t.netFaceRent || 0), 0);
  const offerPrice  = feaso.offerPrice ?? property.askingPrice;
  const askingPrice = property.askingPrice;
  const ltvRatio    = feaso.ltvRatio ?? 0.5;
  const loan        = offerPrice ? offerPrice * ltvRatio : null;
  const duration    = feaso.projectDurationYears;

  // ── Market rent totals ────────────────────────────────────────────────────
  const mrLowTotal  = feaso.marketRentLow  && nla ? feaso.marketRentLow  * nla : null;
  const mrHighTotal = feaso.marketRentHigh && nla ? feaso.marketRentHigh * nla : null;

  // ── Asking price $/sqm ────────────────────────────────────────────────────
  const apPsmBuild  = askingPrice && nla ? Math.round(askingPrice / nla) : null;
  const apPsmLand   = askingPrice && la  ? Math.round(askingPrice / la)  : null;
  const offPsmBuild = offerPrice  && nla ? Math.round(offerPrice  / nla) : null;
  const offPsmLand  = offerPrice  && la  ? Math.round(offerPrice  / la)  : null;

  // ── Acquisition costs ─────────────────────────────────────────────────────
  const stampDutyPct = feaso.stampDutyPct ?? 0;
  const stampDuty    = offerPrice ? offerPrice * (stampDutyPct / 100) : null;
  const closingCosts = feaso.closingCosts ?? null;
  const baFeePct     = feaso.baFeePct ?? 2.5;
  const baFee        = offerPrice ? offerPrice * (baFeePct / 100) : null;
  const totalAcq     = offerPrice != null
    ? offerPrice + (stampDuty ?? 0) + (closingCosts ?? 0) + (baFee ?? 0)
    : null;

  // ── Project costs ──────────────────────────────────────────────────────────
  const leasingCostsPct  = feaso.leasingCostsPct ?? 11;
  const leasingCosts     = mrLowTotal ? mrLowTotal * (leasingCostsPct / 100) : null;
  const incentivesPct    = feaso.incentivesPct ?? 15;
  const incentiveTerm    = feaso.incentiveTermYears ?? 5;
  const incentives       = mrLowTotal ? mrLowTotal * (incentivesPct / 100) * incentiveTerm : null;
  const interestRatePct  = feaso.interestRatePct ?? 6.5;
  const interest         = loan && duration ? loan * (interestRatePct / 100) * duration : null;
  const works            = feaso.works ?? null;
  const vacancyMonths    = feaso.vacancyMonths ?? 3;
  const vacancyCost      = currentRent > 0 ? (currentRent / 12) * vacancyMonths : null;
  const rentIncome       = currentRent > 0 && duration ? currentRent * duration : null;
  const totalProject     =
    (leasingCosts ?? 0) + (incentives ?? 0) + (interest ?? 0) +
    (works ?? 0) + (vacancyCost ?? 0) - (rentIncome ?? 0);
  const totalCosts       = totalAcq != null ? totalAcq + totalProject : null;

  // ── Outputs ───────────────────────────────────────────────────────────────
  const adoptedCapRate = feaso.adoptedCapRate;
  const newValue       = mrLowTotal && adoptedCapRate ? mrLowTotal / (adoptedCapRate / 100) : null;
  const netProfit      = newValue != null && totalCosts != null ? newValue - totalCosts : null;
  const profitMargin   = newValue && netProfit != null ? (netProfit / newValue) * 100 : null;
  const equity         = totalCosts != null && loan != null ? totalCosts - loan : null;
  const roi            = netProfit != null && equity && equity > 0 ? (netProfit / equity) * 100 : null;
  const irr            = roi != null && duration && duration > 0 ? roi / duration : null;

  // Yields
  const yieldAsk  = currentRent > 0 && askingPrice  ? (currentRent  / askingPrice)  * 100 : null;
  const yieldMrLow  = mrLowTotal  && offerPrice ? (mrLowTotal  / offerPrice) * 100 : null;
  const yieldMrHigh = mrHighTotal && offerPrice ? (mrHighTotal / offerPrice) * 100 : null;

  return (
    <div className="space-y-7">

      {/* ══ MARKET BENCHMARKS — Adopted ranges from evidence ════════════════ */}
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-3">
          Value-Add Benchmarks
        </h3>
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          {/* Header row: Adopted | Min | Max */}
          <div className="grid grid-cols-4 bg-[#0A0A0A] border-b border-white/[0.06]">
            {['', 'Adopted', 'Min', 'Max'].map((h) => (
              <div key={h} className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-100/30">{h}</div>
            ))}
          </div>
          {/* Market rent row */}
          <div className="grid grid-cols-4 border-b border-white/[0.04] hover:bg-white/[0.01] items-center">
            <div className="px-4 py-2.5 text-xs text-brand-100/50">Market rent (net)</div>
            <div className="px-4 py-2.5 text-xs text-brand-100/30">$/m²</div>
            <FeasoFieldCell
              value={feaso.marketRentLow}
              display={feaso.marketRentLow ? `$${feaso.marketRentLow}/m²` : null}
              onSave={(n) => save({ marketRentLow: n })}
            />
            <FeasoFieldCell
              value={feaso.marketRentHigh}
              display={feaso.marketRentHigh ? `$${feaso.marketRentHigh}/m²` : null}
              onSave={(n) => save({ marketRentHigh: n })}
            />
          </div>
          {/* Market sale price — land */}
          <div className="grid grid-cols-4 border-b border-white/[0.04] hover:bg-white/[0.01] items-center">
            <div className="px-4 py-2.5 text-xs text-brand-100/50">Sale price (land)</div>
            <div className="px-4 py-2.5 text-xs text-brand-100/30">$/m²</div>
            <FeasoFieldCell
              value={feaso.salePricePerSqmLandLow}
              display={feaso.salePricePerSqmLandLow ? `$${Math.round(feaso.salePricePerSqmLandLow).toLocaleString()}` : null}
              onSave={(n) => save({ salePricePerSqmLandLow: n })}
            />
            <FeasoFieldCell
              value={feaso.salePricePerSqmLandHigh}
              display={feaso.salePricePerSqmLandHigh ? `$${Math.round(feaso.salePricePerSqmLandHigh).toLocaleString()}` : null}
              onSave={(n) => save({ salePricePerSqmLandHigh: n })}
            />
          </div>
          {/* Market sale price — build */}
          <div className="grid grid-cols-4 hover:bg-white/[0.01] items-center">
            <div className="px-4 py-2.5 text-xs text-brand-100/50">Sale price (build)</div>
            <div className="px-4 py-2.5 text-xs text-brand-100/30">$/m²</div>
            <FeasoFieldCell
              value={feaso.salePricePerSqmBuildLow}
              display={feaso.salePricePerSqmBuildLow ? `$${Math.round(feaso.salePricePerSqmBuildLow).toLocaleString()}` : null}
              onSave={(n) => save({ salePricePerSqmBuildLow: n })}
            />
            <FeasoFieldCell
              value={feaso.salePricePerSqmBuildHigh}
              display={feaso.salePricePerSqmBuildHigh ? `$${Math.round(feaso.salePricePerSqmBuildHigh).toLocaleString()}` : null}
              onSave={(n) => save({ salePricePerSqmBuildHigh: n })}
            />
          </div>
          {/* Rates: Asking vs Offer */}
          <div className="grid grid-cols-4 bg-white/[0.015] border-t border-white/[0.06]">
            {['', 'Asking', 'Offer', ''].map((h) => (
              <div key={h} className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-100/25">{h}</div>
            ))}
          </div>
          <div className="grid grid-cols-4 border-b border-white/[0.04] hover:bg-white/[0.01] items-center">
            <div className="px-4 py-2.5 text-xs text-brand-100/50">Price</div>
            <div className="px-4 py-2.5 text-sm font-semibold text-brand-200 tabular-nums">{fmt$(askingPrice)}</div>
            <FeasoFieldCell
              value={feaso.offerPrice}
              display={fmt$(offerPrice)}
              onSave={(n) => save({ offerPrice: n })}
              highlight
            />
            <div />
          </div>
          <div className="grid grid-cols-4 border-b border-white/[0.04] items-center">
            <div className="px-4 py-1.5 text-[11px] text-brand-100/30">$/m² build</div>
            <div className="px-4 py-1.5 text-xs text-brand-100/40 tabular-nums">{apPsmBuild ? `$${apPsmBuild.toLocaleString()}` : '—'}</div>
            <div className="px-4 py-1.5 text-xs text-brand-100/40 tabular-nums">{offPsmBuild ? `$${offPsmBuild.toLocaleString()}` : '—'}</div>
            <div />
          </div>
          <div className="grid grid-cols-4 items-center">
            <div className="px-4 py-1.5 text-[11px] text-brand-100/30">$/m² land</div>
            <div className="px-4 py-1.5 text-xs text-brand-100/40 tabular-nums">{apPsmLand ? `$${apPsmLand.toLocaleString()}` : '—'}</div>
            <div className="px-4 py-1.5 text-xs text-brand-100/40 tabular-nums">{offPsmLand ? `$${offPsmLand.toLocaleString()}` : '—'}</div>
            <div />
          </div>
        </div>
      </section>

      {/* ══ TENANCY TABLE — current vs market rent per unit ═════════════════ */}
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-3">
          Leasing Feasibility
        </h3>
        {tenants.length === 0 ? (
          <p className="text-xs text-brand-100/25 italic py-3">
            No tenants — add them on the Tenancy Schedule tab.
          </p>
        ) : (
          <div className="rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0A0A0A] border-b border-white/[0.06]">
                    {['Unit', 'Tenant', 'Size', 'Expiry', 'Options', 'Reviews', 'Current Rent', '$/m²', 'Mkt Rent Low', '$/m²', 'Mkt Rent High', '$/m²'].map((h) => (
                      <th key={h} className="px-3 py-2 text-[9px] font-semibold uppercase tracking-widest text-brand-100/30 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const unitMrLow  = feaso.marketRentLow  && t.lettableArea ? feaso.marketRentLow  * t.lettableArea : null;
                    const unitMrHigh = feaso.marketRentHigh && t.lettableArea ? feaso.marketRentHigh * t.lettableArea : null;
                    const unitPsm    = t.netFaceRent && t.lettableArea ? Math.round(t.netFaceRent / t.lettableArea) : null;
                    const unitMrLowPsm  = feaso.marketRentLow  ?? null;
                    const unitMrHighPsm = feaso.marketRentHigh ?? null;
                    return (
                      <tr key={t.id} className="border-t border-white/[0.04] hover:bg-white/[0.01]">
                        <td className="px-3 py-2.5 text-sm text-brand-200 font-mono tabular-nums">{t.suite || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-brand-50 font-medium whitespace-nowrap">{t.tenantName}</td>
                        <td className="px-3 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
                          {t.lettableArea ? `${t.lettableArea.toLocaleString()} m²` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-brand-100/45 whitespace-nowrap">{t.leaseEnd || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-brand-100/45 whitespace-nowrap">{t.options || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-brand-100/45 whitespace-nowrap">{t.reviewType || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
                          {t.netFaceRent ? `$${Math.round(t.netFaceRent).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-brand-300 tabular-nums whitespace-nowrap">
                          {unitPsm ? `$${unitPsm}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                          {unitMrLow ? `$${Math.round(unitMrLow).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-emerald-400/60 tabular-nums whitespace-nowrap">
                          {unitMrLowPsm ? `$${unitMrLowPsm}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-emerald-400 tabular-nums whitespace-nowrap">
                          {unitMrHigh ? `$${Math.round(unitMrHigh).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-emerald-400/60 tabular-nums whitespace-nowrap">
                          {unitMrHighPsm ? `$${unitMrHighPsm}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t border-white/[0.08] bg-white/[0.015]">
                    <td className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-brand-100/50" colSpan={2}>Total</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-brand-200 tabular-nums">
                      {nla ? `${nla.toLocaleString()} m²` : '—'}
                    </td>
                    <td colSpan={3} />
                    <td className="px-3 py-2.5 text-xs font-semibold text-brand-200 tabular-nums">
                      {currentRent > 0 ? `$${Math.round(currentRent).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-brand-200 tabular-nums">
                      {currentRent > 0 && nla ? `$${Math.round(currentRent / nla)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-emerald-400 tabular-nums">
                      {mrLowTotal ? `$${Math.round(mrLowTotal).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-emerald-400/60 tabular-nums">
                      {feaso.marketRentLow ? `$${feaso.marketRentLow}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-emerald-400 tabular-nums">
                      {mrHighTotal ? `$${Math.round(mrHighTotal).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-emerald-400/60 tabular-nums">
                      {feaso.marketRentHigh ? `$${feaso.marketRentHigh}` : '—'}
                    </td>
                  </tr>
                  {/* Yield rows */}
                  {(yieldAsk || yieldMrLow || yieldMrHigh) && (
                    <tr className="border-t border-white/[0.04] bg-white/[0.01]">
                      <td colSpan={6} />
                      <td className="px-3 py-1.5 text-[10px] text-brand-100/35">
                        Yield (asking): <span className="text-brand-300 font-semibold">{fmtPct(yieldAsk)}</span>
                      </td>
                      <td />
                      <td className="px-3 py-1.5 text-[10px] text-emerald-400/60">
                        Yield: <span className="font-semibold">{fmtPct(yieldMrLow)}</span>
                      </td>
                      <td />
                      <td className="px-3 py-1.5 text-[10px] text-emerald-400/60">
                        Yield: <span className="font-semibold">{fmtPct(yieldMrHigh)}</span>
                      </td>
                      <td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ══ ACQUISITION + PROJECT COSTS — two columns ══════════════════════ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Acquisition */}
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-100/50">Acquisition</p>
          </div>
          <div className="px-4 py-1">
            <FeasoField
              label="Project duration"
              rawValue={feaso.projectDurationYears}
              displayValue={feaso.projectDurationYears ? `${feaso.projectDurationYears} years` : null}
              onSave={(n) => save({ projectDurationYears: n })}
            />
            <FeasoField
              label="Offer price"
              rawValue={feaso.offerPrice ?? property.askingPrice}
              displayValue={fmt$(offerPrice)}
              hint={!feaso.offerPrice ? 'from asking price' : undefined}
              onSave={(n) => save({ offerPrice: n })}
              highlight
            />
            <FeasoField
              label="Stamp duty"
              rawValue={stampDutyPct}
              displayValue={`${stampDutyPct}%`}
              unit={stampDuty != null ? `(${fmtRaw(stampDuty)})` : undefined}
              hint="0% SA via scheme"
              onSave={(n) => save({ stampDutyPct: n })}
            />
            <FeasoField
              label="Closing costs"
              rawValue={feaso.closingCosts}
              displayValue={fmt$(closingCosts)}
              onSave={(n) => save({ closingCosts: n })}
            />
            <FeasoField
              label="BA fee"
              rawValue={baFeePct}
              displayValue={`${baFeePct}%`}
              unit={baFee != null ? `(${fmtRaw(baFee)})` : undefined}
              onSave={(n) => save({ baFeePct: n })}
            />
            <TotalLine label="Total Acquisition" value={totalAcq} />
          </div>
        </div>

        {/* Project costs */}
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-100/50">Project Costs</p>
          </div>
          <div className="px-4 py-1">
            <FeasoField
              label="LTV ratio"
              rawValue={(feaso.ltvRatio ?? 0.5) * 100}
              displayValue={`${Math.round(ltvRatio * 100)}%`}
              unit={loan != null ? `(loan ${fmt$(loan)})` : undefined}
              onSave={(n) => save({ ltvRatio: n > 1 ? n / 100 : n })}
            />
            <FeasoField
              label="Interest rate"
              rawValue={feaso.interestRatePct ?? 6.5}
              displayValue={`${interestRatePct}% IO`}
              unit={interest != null ? `(${fmtRaw(interest)})` : undefined}
              onSave={(n) => save({ interestRatePct: n })}
            />
            <FeasoField
              label="Leasing costs"
              rawValue={leasingCostsPct}
              displayValue={`${leasingCostsPct}%`}
              hint="of market rent"
              unit={leasingCosts != null ? `(${fmtRaw(leasingCosts)})` : undefined}
              onSave={(n) => save({ leasingCostsPct: n })}
            />
            <FeasoField
              label="Incentives"
              rawValue={incentivesPct}
              displayValue={`${incentivesPct}% · ${incentiveTerm}yr term`}
              unit={incentives != null ? `(${fmtRaw(incentives)})` : undefined}
              onSave={(n) => save({ incentivesPct: n })}
            />
            <FeasoField
              label="Works / makegood"
              rawValue={feaso.works}
              displayValue={fmt$(works)}
              onSave={(n) => save({ works: n })}
            />
            <FeasoField
              label="Vacancy"
              rawValue={feaso.vacancyMonths ?? 3}
              displayValue={`${vacancyMonths} months`}
              unit={vacancyCost != null ? `(${fmtRaw(vacancyCost)})` : undefined}
              onSave={(n) => save({ vacancyMonths: n })}
            />
            {rentIncome != null && (
              <CostLine label="Rental income" hint="deducted — during project" calculatedValue={-rentIncome} />
            )}
            <TotalLine label="Total Project Costs" value={totalProject} />
            <TotalLine label="Total Costs" value={totalCosts} highlight />
          </div>
        </div>
      </section>

      {/* ══ OUTPUTS ══════════════════════════════════════════════════════════ */}
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-3">
          Analysis Outputs
        </h3>

        {/* Adopted cap rate input — drives new value */}
        <div className="flex items-center gap-4 mb-4 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.01]">
          <span className="text-xs text-brand-100/45 shrink-0">Adopted cap rate</span>
          <FeasoFieldInline
            rawValue={feaso.adoptedCapRate}
            displayValue={feaso.adoptedCapRate ? `${feaso.adoptedCapRate}%` : null}
            onSave={(n) => save({ adoptedCapRate: n })}
            placeholder="e.g. 5.50"
            highlight
          />
          {mrLowTotal && feaso.adoptedCapRate && (
            <span className="text-xs text-brand-100/30 ml-auto">
              → new value {fmt$(mrLowTotal / (feaso.adoptedCapRate / 100))}
            </span>
          )}
        </div>

        {(!feaso.adoptedCapRate || !feaso.marketRentLow) && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-900/10 border border-amber-700/20 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400/80 leading-relaxed">
              Set <strong className="text-amber-400">market rent low</strong> (in benchmarks above) and{' '}
              <strong className="text-amber-400">adopted cap rate</strong> to calculate new property value.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <OutputTile label="New Value"     value={newValue    ? fmt$(newValue)                   : null} neutral />
          <OutputTile label="Net Profit"    value={netProfit   != null ? fmt$(netProfit)           : null} positive={netProfit > 0}     negative={netProfit < 0} />
          <OutputTile label="Profit Margin" value={profitMargin != null ? `${profitMargin.toFixed(1)}%` : null} positive={profitMargin > 15}  negative={profitMargin < 0} />
          <OutputTile label="ROI"           value={roi         != null ? `${roi.toFixed(1)}%`      : null} positive={roi > 30}          negative={roi < 0} />
          <OutputTile label="IRR"           value={irr         != null ? `${irr.toFixed(1)}%`      : null} positive={irr > 15}          negative={irr < 0} />
        </div>

        {newValue && totalCosts && (
          <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-brand-100/30 mb-1">New Value $/m² Build</p>
              <p className="text-brand-200 font-semibold tabular-nums">{nla ? `$${Math.round(newValue / nla).toLocaleString()}/m²` : '—'}</p>
            </div>
            <div>
              <p className="text-brand-100/30 mb-1">New Value $/m² Land</p>
              <p className="text-brand-200 font-semibold tabular-nums">{la ? `$${Math.round(newValue / la).toLocaleString()}/m²` : '—'}</p>
            </div>
            <div>
              <p className="text-brand-100/30 mb-1">Equity Invested</p>
              <p className="text-brand-200 font-semibold tabular-nums">{fmt$(equity)}</p>
            </div>
            <div>
              <p className="text-brand-100/30 mb-1">Loan</p>
              <p className="text-brand-200 font-semibold tabular-nums">{fmt$(loan)}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Inline cell editor for the benchmark table grid ───────────────────────────
function FeasoFieldCell({ value, display, onSave, highlight }) {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef                = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n) && n !== value) onSave(n);
    setEditing(false);
  };

  return (
    <div className="px-4 py-2.5 group cursor-pointer" onClick={!editing ? () => { setInputVal(value != null ? String(value) : ''); setEditing(true); } : undefined}>
      {editing ? (
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-full bg-transparent border-b border-brand-500/60 text-sm text-brand-100 focus:outline-none py-0.5 tabular-nums"
          placeholder="0"
        />
      ) : (
        <span className={`text-sm font-semibold tabular-nums flex items-center gap-1 ${highlight ? 'text-brand-500' : display ? 'text-brand-200' : 'text-brand-100/25 italic text-xs font-normal'}`}>
          {display ?? 'Click to add'}
          <Pencil className="w-2.5 h-2.5 text-brand-100/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
      )}
    </div>
  );
}

// ── Inline field for the adopted cap rate bar ─────────────────────────────────
function FeasoFieldInline({ rawValue, displayValue, onSave, placeholder, highlight }) {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef                = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };

  return editing ? (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 bg-transparent border-b border-brand-500/60 text-sm text-brand-100 focus:outline-none tabular-nums"
        placeholder={placeholder}
      />
      <span className="text-xs text-brand-100/30">%</span>
    </div>
  ) : (
    <button onClick={() => { setInputVal(rawValue != null ? String(rawValue) : ''); setEditing(true); }}
      className="flex items-center gap-1.5 group/btn">
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-brand-500' : displayValue ? 'text-brand-200' : 'text-brand-100/30 italic text-xs font-normal'}`}>
        {displayValue ?? 'Click to add'}
      </span>
      <Pencil className="w-2.5 h-2.5 text-brand-100/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
    </button>
  );
}
