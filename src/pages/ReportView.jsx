import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { CheckCircle2, XCircle, TrendingUp, Building2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { Spinner } from '../components/ui/Loading';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtPct = (v) => (v != null ? `${v}%` : '—');
const fmtSqm = (v) => (v ? `${Math.round(v).toLocaleString()} m²` : '—');

function StatBox({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-1 p-5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/40">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${accent ? 'text-brand-500' : 'text-brand-50'}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">{children}</span>
      <div className="flex-1 h-px bg-brand-800/40" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ReportView() {
  const { token } = useParams();
  const markViewed   = useMutation(api.dealReports.markReportViewed);
  const submitDecision = useMutation(api.dealReports.submitClientDecision);

  const data = useQuery(api.dealReports.getReportByToken, token ? { token } : 'skip');

  const [decision, setDecision]   = useState(null); // 'approved' | 'declined'
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Mark viewed once on load
  useEffect(() => {
    if (data?.report && token) {
      markViewed({ token }).catch(() => {});
    }
  }, [data?.report?._id]);

  if (data === undefined) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Spinner className="w-7 h-7" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-8">
        <div className="w-14 h-14 rounded-xl bg-brand-900/30 border border-brand-800/40 flex items-center justify-center mb-5">
          <Building2 className="w-6 h-6 text-brand-500/50" />
        </div>
        <h1 className="text-xl font-semibold text-brand-50 mb-2">Report not found</h1>
        <p className="text-sm text-brand-100/40 max-w-xs">
          This link may have expired or the report has been removed.
          Contact Property Lions for assistance.
        </p>
      </div>
    );
  }

  const { report, property, feaso } = data;
  const leasingComps = (data.comps || []).filter(c => c.type === 'lease');
  const salesComps   = (data.comps || []).filter(c => c.type === 'sale');
  const alreadyDecided = !!report.clientDecision;

  // Feaso outputs (mirroring ProjectFeasibilityTab logic)
  const nla          = property?.buildingArea || 0;
  const marketRentMid = feaso && feaso.marketRentLow && feaso.marketRentHigh
    ? (feaso.marketRentLow + feaso.marketRentHigh) / 2 : null;
  const newValue     = marketRentMid && feaso?.adoptedCapRate
    ? (marketRentMid * nla) / (feaso.adoptedCapRate / 100) : null;
  const offerPrice   = feaso?.offerPrice;
  const totalCosts   = offerPrice
    ? offerPrice * (1 + (feaso?.stampDutyPct || 0) / 100 + (feaso?.baFeePct || 0) / 100)
      + (feaso?.closingCosts || 0) + (feaso?.works || 0) : null;
  const netProfit    = newValue && totalCosts ? newValue - totalCosts : null;
  const roi          = netProfit && offerPrice ? (netProfit / offerPrice) * 100 : null;

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      await submitDecision({ token, decision, note: note || undefined });
      setSubmitted(true);
    } catch {
      // Already decided — show as submitted
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-brand-50">

      {/* Nav bar */}
      <div className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#050505]/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
            <div className="w-3.5 h-3.5 border-[1.5px] border-brand-500 rotate-45" />
          </div>
          <span className="text-sm font-semibold tracking-wider text-brand-50">PROPERTY LIONS</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 border border-white/[0.06] px-2.5 py-1 rounded-full">
          Confidential
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">

        {/* Hero */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-500/70">
            Deal Proposal · Prepared for {report.clientName}
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight">{property?.address}</h1>
          <p className="text-brand-100/50 text-sm">
            {property?.suburb && `${property.suburb} · `}
            {property?.assetType} · {property?.status}
          </p>
        </div>

        {/* Property metrics */}
        <div>
          <SectionTitle>The Property</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Asking Price"   value={formatCurrency(property?.askingPrice)}  accent />
            <StatBox label="Building Area"  value={fmtSqm(property?.buildingArea)} />
            <StatBox label="Land Area"      value={fmtSqm(property?.landArea)} />
            <StatBox label="Est. Yield"     value={fmtPct(property?.estimatedYield)} />
          </div>
        </div>

        {/* Feasibility numbers — only if feaso data exists */}
        {feaso && (offerPrice || newValue) && (
          <div>
            <SectionTitle>The Numbers</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatBox label="Offer Price"  value={formatCurrency(offerPrice)}           />
              <StatBox label="New Value"    value={formatCurrency(newValue)}    accent    />
              <StatBox label="Net Profit"   value={formatCurrency(netProfit)}   accent={netProfit > 0} />
              <StatBox label="Proj. ROI"    value={roi ? `${roi.toFixed(1)}%` : '—'} accent={roi > 0} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Cap Rate"    value={fmtPct(feaso.adoptedCapRate)} />
              <StatBox label="Market Rent" value={marketRentMid ? `$${Math.round(marketRentMid)}/m²` : '—'} />
              <StatBox label="Duration"    value={feaso.projectDurationYears ? `${feaso.projectDurationYears} yrs` : '—'} />
            </div>
          </div>
        )}

        {/* Leasing evidence */}
        {leasingComps.length > 0 && (
          <div>
            <SectionTitle>Leasing Evidence</SectionTitle>
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45">Address</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">NLA</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">Rent pa</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">$/m²</th>
                  </tr>
                </thead>
                <tbody>
                  {leasingComps.map(c => (
                    <tr key={c._id} className="border-t border-white/[0.04]">
                      <td className="px-4 py-2.5 text-brand-100/80">{c.address}</td>
                      <td className="px-4 py-2.5 text-brand-100/50 text-right tabular-nums">{fmtSqm(c.nlaSqm)}</td>
                      <td className="px-4 py-2.5 text-brand-100/70 text-right tabular-nums">{formatCurrency(c.rentPa)}</td>
                      <td className="px-4 py-2.5 font-semibold text-brand-500 text-right tabular-nums">
                        {c.rentPerSqm ? `$${Math.round(c.rentPerSqm)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sales evidence */}
        {salesComps.length > 0 && (
          <div>
            <SectionTitle>Sales Evidence</SectionTitle>
            <div className="rounded-xl border border-white/[0.07] overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45">Address</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">Sale Price</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">$/m²</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">Cap Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {salesComps.map(c => (
                    <tr key={c._id} className="border-t border-white/[0.04]">
                      <td className="px-4 py-2.5 text-brand-100/80">{c.address}</td>
                      <td className="px-4 py-2.5 text-brand-100/70 text-right tabular-nums">{formatCurrency(c.salePrice)}</td>
                      <td className="px-4 py-2.5 font-semibold text-brand-500 text-right tabular-nums">
                        {c.pricePerSqmBuild ? `$${Math.round(c.pricePerSqmBuild).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-brand-100/50 text-right tabular-nums">
                        {c.capRate ? fmtPct(c.capRate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analyst note */}
        {report.analystMessage && (
          <div>
            <SectionTitle>Property Lions Note</SectionTitle>
            <div className="p-5 rounded-xl border border-brand-800/30 bg-brand-900/10">
              <p className="text-sm text-brand-100/70 leading-relaxed whitespace-pre-wrap">{report.analystMessage}</p>
            </div>
          </div>
        )}

        {/* Decision section */}
        <div className="border-t border-white/[0.06] pt-10">
          {alreadyDecided || submitted ? (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              {report.clientDecision === 'approved' || decision === 'approved' ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              ) : (
                <XCircle className="w-10 h-10 text-red-400" />
              )}
              <p className="text-base font-semibold text-brand-50">
                {report.clientDecision === 'approved' || decision === 'approved'
                  ? 'You approved this deal'
                  : 'You declined this deal'}
              </p>
              <p className="text-sm text-brand-100/40">Property Lions has been notified.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <SectionTitle>Your Decision</SectionTitle>
              <p className="text-sm text-brand-100/50 -mt-2">
                Let Property Lions know whether you want to proceed with this property.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDecision('approved')}
                  className={`flex-1 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                    decision === 'approved'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'border-white/[0.08] text-brand-100/50 hover:border-white/20 hover:text-white'
                  }`}
                >
                  Approve — proceed
                </button>
                <button
                  onClick={() => setDecision('declined')}
                  className={`flex-1 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                    decision === 'declined'
                      ? 'bg-red-500/10 border-red-500/40 text-red-400'
                      : 'border-white/[0.08] text-brand-100/50 hover:border-white/20 hover:text-white'
                  }`}
                >
                  Decline — pass
                </button>
              </div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional note for the team…"
                rows={3}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-brand-100/80 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/40 transition-colors resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!decision || submitting}
                className="w-full py-3.5 bg-brand-500 text-brand-950 text-sm font-bold rounded-xl hover:bg-brand-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit decision'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-white/[0.04]">
          <p className="text-[11px] text-brand-100/40">
            Property Lions · Commercial Buyers Agency · oracle.propertylions.com.au
          </p>
          <p className="text-[10px] text-brand-100/15 mt-1">
            This report is confidential and prepared exclusively for {report.clientName}.
          </p>
        </div>

      </div>
    </div>
  );
}
