import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ArrowLeft, CheckCircle2, XCircle, FileText, Download } from 'lucide-react';
import { PageLoader } from '../../components/ui/Loading';
import { VideoCard } from '../../components/properties/PropertyVideos';
import { formatCurrency, formatFileSize } from '../../utils/format';
import { useGoBack } from '../../hooks/useGoBack';

// Reuse same helpers as ReportView
const fmtPct = (v) => (v != null ? `${v}%` : '—');
const fmtSqm = (v) => (v != null ? `${Math.round(v).toLocaleString()} m²` : '—');

function StatBox({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/40">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${accent ? 'text-brand-500' : 'text-brand-50'}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">{children}</span>
      <div className="flex-1 h-px bg-brand-800/40" />
    </div>
  );
}

export function ClientDealView() {
  const { token } = useParams();
  const goBack = useGoBack('/client');
  const submitDecision = useMutation(api.dealReports.submitClientDecision);
  const markViewed     = useMutation(api.dealReports.markReportViewed);

  const data = useQuery(api.clientPortal.getMyReport, token ? { token } : 'skip');

  const [decision, setDecision]     = useState(null);
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    if (data?.report && token) {
      markViewed({ token }).catch(() => {});
    }
  }, [data?.report?._id]);

  if (data === undefined) {
    return <PageLoader />;
  }
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <p className="text-brand-100/40 text-sm">Deal not found or you don't have access to it.</p>
        <button onClick={goBack} className="mt-4 text-brand-500 text-sm hover:text-brand-400">
          Back to dashboard
        </button>
      </div>
    );
  }

  const { report, property, feaso } = data;
  const leasingComps  = (data.comps || []).filter(c => c.type === 'lease');
  const salesComps    = (data.comps || []).filter(c => c.type === 'sale');
  const alreadyDecided = !!report.clientDecision;
  const nla            = property?.buildingArea || 0;
  const marketRentMid  = feaso?.marketRentLow && feaso?.marketRentHigh
    ? (feaso.marketRentLow + feaso.marketRentHigh) / 2 : null;
  const newValue       = marketRentMid && feaso?.adoptedCapRate
    ? (marketRentMid * nla) / (feaso.adoptedCapRate / 100) : null;
  const offerPrice     = feaso?.offerPrice;
  const totalCosts     = offerPrice
    ? offerPrice * (1 + (feaso?.stampDutyPct || 0) / 100 + (feaso?.baFeePct || 0) / 100)
      + (feaso?.closingCosts || 0) + (feaso?.works || 0) : null;
  const netProfit      = newValue && totalCosts ? newValue - totalCosts : null;
  const roi            = netProfit && offerPrice ? (netProfit / offerPrice) * 100 : null;

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      await submitDecision({ token, decision, note: note || undefined });
      setSubmitted(true);
    } catch { setSubmitted(true); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">

      {/* Back */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-xs text-brand-100/40 hover:text-brand-400 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
      </button>

      {/* Hero */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-500/70">Deal Proposal</p>
        <h1 className="text-2xl font-bold text-white leading-tight">{property?.address}</h1>
        <p className="text-sm text-brand-100/40">
          {property?.suburb && `${property.suburb} · `}{property?.assetType}
        </p>
      </div>

      {/* Property stats */}
      <div>
        <SectionTitle>The Property</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Asking Price" value={formatCurrency(property?.askingPrice)} accent />
          <StatBox label="Building"     value={fmtSqm(property?.buildingArea)} />
          <StatBox label="Land Area"    value={fmtSqm(property?.landArea)} />
          <StatBox label="Est. Yield"   value={fmtPct(property?.estimatedYield)} />
        </div>
      </div>

      {/* Walkthrough videos */}
      {data.videos?.length > 0 && (
        <div>
          <SectionTitle>Walkthrough</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.videos.map((v) => (
              <VideoCard key={v.id} vid={v} src={v.kind === 'upload' ? v.url : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* Deal documents — only files staff marked client-visible reach here;
          internal ones are filtered server-side and never sent. */}
      {data.files?.length > 0 && (
        <div>
          <SectionTitle>Documents</SectionTitle>
          <div className="flex flex-col gap-2">
            {data.files.map((f) => (
              <a
                key={f._id}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-brand-500/30 hover:bg-white/[0.04] transition-colors"
              >
                <FileText className="w-4 h-4 text-brand-500/70 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-brand-50 truncate">{f.fileName}</p>
                  <p className="text-[11px] text-brand-100/40">
                    {[f.category, formatFileSize(f.size)].filter(Boolean).join(' · ') || 'Document'}
                  </p>
                </div>
                <Download className="w-4 h-4 text-brand-100/30 group-hover:text-brand-400 shrink-0 transition-colors" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Feaso numbers */}
      {feaso && (offerPrice || newValue) && (
        <div>
          <SectionTitle>The Numbers</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <StatBox label="Offer Price" value={formatCurrency(offerPrice)} />
            <StatBox label="New Value"   value={formatCurrency(newValue)} accent />
            <StatBox label="Net Profit"  value={formatCurrency(netProfit)} accent={netProfit > 0} />
            <StatBox label="Proj. ROI"   value={roi ? `${roi.toFixed(1)}%` : '—'} accent={roi > 0} />
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
          <div className="rounded-xl border border-white/[0.07] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-white/[0.02] border-b border-white/[0.05]">
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45">Address</th>
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">NLA</th>
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">Rent pa</th>
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">$/m²</th>
              </tr></thead>
              <tbody>
                {leasingComps.map(c => (
                  <tr key={c._id} className="border-t border-white/[0.04]">
                    <td className="px-3 sm:px-4 py-2.5 text-brand-100/80">{c.address}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-brand-100/50 text-right tabular-nums">{fmtSqm(c.nlaSqm)}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-brand-100/70 text-right tabular-nums">{formatCurrency(c.rentPa)}</td>
                    <td className="px-3 sm:px-4 py-2.5 font-semibold text-brand-500 text-right tabular-nums">
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
          <div className="rounded-xl border border-white/[0.07] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-white/[0.02] border-b border-white/[0.05]">
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45">Address</th>
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">Sale Price</th>
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">$/m²</th>
                <th className="px-3 sm:px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-100/45 text-right">Cap Rate</th>
              </tr></thead>
              <tbody>
                {salesComps.map(c => (
                  <tr key={c._id} className="border-t border-white/[0.04]">
                    <td className="px-3 sm:px-4 py-2.5 text-brand-100/80">{c.address}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-brand-100/70 text-right tabular-nums">{formatCurrency(c.salePrice)}</td>
                    <td className="px-3 sm:px-4 py-2.5 font-semibold text-brand-500 text-right tabular-nums">
                      {c.pricePerSqmBuild ? `$${Math.round(c.pricePerSqmBuild).toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-brand-100/50 text-right tabular-nums">
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

      {/* Decision */}
      <div className="border-t border-white/[0.06] pt-8">
        {alreadyDecided || submitted ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            {report.clientDecision === 'approved' || decision === 'approved'
              ? <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              : <XCircle className="w-10 h-10 text-red-400" />}
            <p className="text-base font-semibold text-brand-50">
              {report.clientDecision === 'approved' || decision === 'approved'
                ? 'You approved this deal' : 'You declined this deal'}
            </p>
            <p className="text-sm text-brand-100/40">Property Lions has been notified.</p>
            <button onClick={goBack} className="mt-2 text-sm text-brand-500 hover:text-brand-400">
              Back to dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <SectionTitle>Your Decision</SectionTitle>
            <div className="flex gap-3">
              <button onClick={() => setDecision('approved')}
                className={`flex-1 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                  decision === 'approved'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                    : 'border-white/[0.08] text-brand-100/50 hover:border-white/20 hover:text-white'
                }`}>
                Approve — proceed
              </button>
              <button onClick={() => setDecision('declined')}
                className={`flex-1 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                  decision === 'declined'
                    ? 'bg-red-500/10 border-red-500/40 text-red-400'
                    : 'border-white/[0.08] text-brand-100/50 hover:border-white/20 hover:text-white'
                }`}>
                Decline — pass
              </button>
            </div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Optional note for the team…" rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-brand-100/80 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/40 transition-colors resize-none" />
            <button onClick={handleSubmit} disabled={!decision || submitting}
              className="w-full py-3.5 bg-brand-500 text-brand-950 text-sm font-bold rounded-xl hover:bg-brand-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? 'Submitting…' : 'Submit decision'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
