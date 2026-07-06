import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Send, Copy, CheckCircle2, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { SendToClientModal } from '../../reports/SendToClientModal';
import { formatDate } from '../../../utils/format';

const STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: 'text-brand-100/40',  bg: 'bg-white/[0.03]',       border: 'border-white/[0.06]' },
  sent:     { label: 'Sent',     color: 'text-brand-400',     bg: 'bg-brand-900/20',        border: 'border-brand-800/30' },
  viewed:   { label: 'Viewed',   color: 'text-blue-400',      bg: 'bg-blue-900/15',         border: 'border-blue-800/30' },
  approved: { label: 'Approved', color: 'text-emerald-400',   bg: 'bg-emerald-900/15',      border: 'border-emerald-800/30' },
  declined: { label: 'Declined', color: 'text-red-400',       bg: 'bg-red-900/10',          border: 'border-red-800/20' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {status === 'approved' && <CheckCircle2 className="w-2.5 h-2.5" />}
      {status === 'declined' && <XCircle className="w-2.5 h-2.5" />}
      {(status === 'sent' || status === 'viewed') && <Clock className="w-2.5 h-2.5" />}
      {cfg.label}
    </span>
  );
}

function CopyLinkButton({ token }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/report/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-[11px] text-brand-100/40 hover:text-brand-400 transition-colors"
      >
        {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[11px] text-brand-100/40 hover:text-brand-400 transition-colors"
      >
        <ExternalLink className="w-3 h-3" />
        Preview
      </a>
    </div>
  );
}

export function ReportsTab({ property, brief }) {
  const [modalOpen, setModalOpen] = useState(false);

  const reports = useQuery(
    api.dealReports.getReportsByProperty,
    property ? { propertyId: property._id } : 'skip'
  );

  const sorted = [...(reports || [])].sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-50">Client Reports</h2>
          <p className="text-sm text-brand-100/40 mt-0.5">
            Send deal proposals to clients and track their decisions in real time.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={!brief}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-brand-950 text-sm font-semibold rounded-lg hover:bg-brand-400 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          Send to Client
        </button>
      </div>

      {!brief && (
        <div className="px-4 py-3 rounded-lg bg-amber-900/10 border border-amber-800/20 text-xs text-amber-400/70">
          Link this property to a brief first (Pipeline tab) to enable client reports.
        </div>
      )}

      {/* Reports list */}
      {reports === undefined ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[280px] border border-white/[0.05] rounded-xl bg-white/[0.01] text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-900/30 border border-brand-800/40 flex items-center justify-center mb-4">
            <Send className="w-5 h-5 text-brand-500/40" />
          </div>
          <p className="text-sm font-semibold text-brand-50 mb-1">No reports sent yet</p>
          <p className="text-xs text-brand-100/35 max-w-xs leading-relaxed">
            Generate a client-facing link with the feaso summary, market evidence,
            and an approve/decline decision — all in one page.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0A0A0A]/50 border-b border-white/[0.05]">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Client</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Status</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Sent</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 whitespace-nowrap">Responded</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Link</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r._id} className="border-t border-white/[0.04] hover:bg-white/[0.015] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm text-brand-50 font-medium">{r.clientName}</p>
                    {r.clientEmail && (
                      <p className="text-[11px] text-brand-100/35">{r.clientEmail}</p>
                    )}
                    {r.clientNote && (
                      <p className="text-[11px] text-brand-100/35 italic mt-0.5">"{r.clientNote}"</p>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-[11px] text-brand-100/40 whitespace-nowrap">
                    {r.sentAt ? formatDate(r.sentAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-brand-100/40 whitespace-nowrap">
                    {r.respondedAt ? formatDate(r.respondedAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <CopyLinkButton token={r.token} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SendToClientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        property={property}
        brief={brief}
      />
    </div>
  );
}
