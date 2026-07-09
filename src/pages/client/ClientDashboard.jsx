import React from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import { Building2, CheckCircle2, XCircle, Clock, ArrowRight, ShieldCheck, FileText, Download } from 'lucide-react';
import { PageLoader } from '../../components/ui/Loading';
import { formatCurrency, formatDate, formatFileSize } from '../../utils/format';

const STATUS = {
  sent:     { label: 'Awaiting your review', icon: Clock,         color: 'text-brand-400',   bg: 'bg-brand-900/20 border-brand-800/30' },
  viewed:   { label: 'Under review',          icon: Clock,         color: 'text-blue-400',    bg: 'bg-blue-900/15 border-blue-800/30' },
  approved: { label: 'Approved',              icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-900/15 border-emerald-800/30' },
  declined: { label: 'Declined',              icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-900/10 border-red-800/20' },
  draft:    { label: 'Draft',                 icon: Clock,         color: 'text-brand-100/40', bg: 'bg-white/[0.03] border-white/[0.06]' },
};

function DealCard({ report }) {
  const navigate = useNavigate();
  const { property } = report;
  const cfg = STATUS[report.status] || STATUS.draft;
  const Icon = cfg.icon;

  const needsDecision = report.status === 'sent' || report.status === 'viewed';

  return (
    <div
      onClick={() => navigate(`/client/deal/${report.token}`)}
      className="group cursor-pointer rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-brand-50 leading-tight truncate">
            {property?.address ?? report.propertyAddress}
          </p>
          <p className="text-xs text-brand-100/40 mt-0.5">
            {property?.suburb && `${property.suburb} · `}
            {property?.assetType}
          </p>
        </div>
        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
          <Icon className="w-3 h-3" />
          {cfg.label}
        </div>
      </div>

      {/* Key metric */}
      {property?.askingPrice && (
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Asking Price</p>
            <p className="text-lg font-bold text-brand-500 tabular-nums">
              {formatCurrency(property.askingPrice)}
            </p>
          </div>
          {property?.assetType && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Asset Type</p>
              <p className="text-sm font-medium text-brand-100/70">{property.assetType}</p>
            </div>
          )}
          {property?.buildingArea && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Building</p>
              <p className="text-sm font-medium text-brand-100/70">{Math.round(property.buildingArea).toLocaleString()} m²</p>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
        <p className="text-xs text-brand-100/35">
          {needsDecision
            ? 'Your decision is pending'
            : report.clientDecision
            ? `You ${report.clientDecision} this deal`
            : 'View full analysis'}
        </p>
        <ArrowRight className="w-4 h-4 text-brand-100/45 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}

function DocumentsSection({ docs }) {
  if (docs === undefined || docs.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-500/70 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5" /> Compliance documents · {docs.length}
      </h2>
      <div className="space-y-2">
        {docs.map((doc) => {
          const size = formatFileSize(doc.size);
          return (
            <a
              key={doc._id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all p-4"
            >
              <div className="w-9 h-9 rounded-md bg-brand-900/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-brand-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-50 truncate">{doc.fileName}</p>
                <p className="text-xs text-brand-100/40">
                  Shared {formatDate(doc.uploadedAt)}{size ? ` · ${size}` : ''}
                </p>
              </div>
              <Download className="w-4 h-4 text-brand-100/45 group-hover:text-brand-400 transition-colors" />
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function ClientDashboard() {
  const data = useQuery(api.clientPortal.getMyPortalData);
  const docs = useQuery(api.clientPortal.getMyDocuments);

  if (data === undefined) {
    return <PageLoader />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <Building2 className="w-10 h-10 text-brand-500/30 mb-4" />
        <h2 className="text-lg font-semibold text-brand-50 mb-2">No deals yet</h2>
        <p className="text-sm text-brand-100/40 max-w-sm">
          Your Property Lions team will share deal proposals here for your review.
          Contact them if you're expecting to see something.
        </p>
      </div>
    );
  }

  const { clientRecord, reports } = data;
  const pending  = reports.filter(r => r.status === 'sent' || r.status === 'viewed');
  const decided  = reports.filter(r => r.status === 'approved' || r.status === 'declined');

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

      {/* Welcome */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-500/70 mb-1">
          Your deals
        </p>
        <h1 className="text-2xl font-bold text-white">
          {clientRecord ? `Welcome, ${clientRecord.name.split(' ')[0]}` : 'Your Deal Portal'}
        </h1>
        <p className="text-sm text-brand-100/40 mt-1">
          {reports.length === 0
            ? 'No deals have been shared with you yet.'
            : `${reports.length} deal${reports.length !== 1 ? 's' : ''} · ${pending.length} awaiting your decision`}
        </p>
      </div>

      <DocumentsSection docs={docs} />

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-white/[0.05] rounded-xl text-center p-10">
          <Building2 className="w-10 h-10 text-brand-500/20 mb-4" />
          <p className="text-sm font-medium text-brand-100/50">No deals shared yet</p>
          <p className="text-xs text-brand-100/45 mt-1">Your analyst team will share proposals here.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-500/70">
                Awaiting your decision · {pending.length}
              </h2>
              {pending.map(r => <DealCard key={r._id} report={r} />)}
            </section>
          )}
          {decided.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-100/45">
                Decided · {decided.length}
              </h2>
              {decided.map(r => <DealCard key={r._id} report={r} />)}
            </section>
          )}
        </>
      )}

    </div>
  );
}
