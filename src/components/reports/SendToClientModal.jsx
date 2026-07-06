import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const inp = 'w-full bg-white/[0.03] border border-white/[0.08] rounded-md px-3 py-2.5 text-sm text-brand-100/80 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/40 transition-colors';

export function SendToClientModal({ isOpen, onClose, property, brief }) {
  const [clientName, setClientName]   = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [message, setMessage]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [reportLink, setReportLink]   = useState(null);
  const [copied, setCopied]           = useState(false);

  const createReport = useMutation(api.dealReports.createDealReport);

  // Pre-fill from brief's linked client
  useEffect(() => {
    if (!isOpen) return;
    setReportLink(null);
    setCopied(false);
    // Pre-fill client name from brief if available
    if (brief?.clientName) setClientName(brief.clientName);
    else setClientName('');
    setClientEmail('');
    setMessage('');
  }, [isOpen, brief?._id]);

  const handleSend = async () => {
    if (!clientName.trim()) { toast.error('Client name is required'); return; }
    if (!property || !brief) { toast.error('Property and brief are required'); return; }

    setSaving(true);
    try {
      const token = crypto.randomUUID();
      await createReport({
        briefId:         brief._id,
        propertyId:      property._id,
        clientName:      clientName.trim(),
        clientEmail:     clientEmail.trim() || undefined,
        propertyAddress: property.address,
        token,
        analystMessage:  message.trim() || undefined,
      });

      const link = `${window.location.origin}/report/${token}`;
      setReportLink(link);
      toast.success('Report link created');
    } catch (err) {
      toast.error(err.message || 'Failed to create report');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!reportLink) return;
    navigator.clipboard.writeText(reportLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied to clipboard');
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={!reportLink ? onClose : undefined} />
      <div className="relative w-full max-w-md bg-[#0A0A0A] border border-white/[0.08] rounded-xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-semibold text-white">Send to Client</h2>
            <p className="text-xs text-brand-100/40 mt-0.5 truncate max-w-[240px]">{property?.address}</p>
          </div>
          <button onClick={onClose} className="text-brand-100/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {!reportLink ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="send-client-name" className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Client name *</label>
                <input
                  id="send-client-name"
                  className={inp}
                  placeholder="Fred Sawan"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="send-client-email" className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Client email</label>
                <input
                  id="send-client-email"
                  className={inp}
                  type="email"
                  placeholder="fred@example.com"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                />
                <p className="text-[10px] text-brand-100/40">Used for your records — link must still be sent manually for now.</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="send-client-note" className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">Note to client</label>
                <textarea
                  id="send-client-note"
                  className={inp + ' resize-none h-20'}
                  placeholder="Hi Fred, here's the deal proposal we discussed for your review…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 text-sm text-brand-100/50 hover:text-white transition-colors border border-white/[0.06] rounded-lg">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={saving || !clientName.trim()}
                  className="flex-1 py-2.5 bg-brand-500 text-brand-950 text-sm font-semibold rounded-lg hover:bg-brand-400 transition-all disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Generate link'}
                </button>
              </div>
            </>
          ) : (
            /* Link created state */
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-sm font-semibold text-brand-50">Report link ready</p>
              </div>
              <p className="text-xs text-brand-100/40 leading-relaxed">
                Copy and send this link to <strong className="text-brand-100/70">{clientName}</strong>.
                You'll see their decision update in real time on the Reports tab.
              </p>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.07]">
                <span className="text-xs text-brand-100/60 truncate flex-1 font-mono">{reportLink}</span>
                <button
                  onClick={handleCopy}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    copied
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-brand-500/10 text-brand-400 border border-brand-500/30 hover:bg-brand-500/20'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <a
                href={reportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 text-xs text-brand-100/50 hover:text-brand-400 transition-colors border border-white/[0.06] rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview report
              </a>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-brand-500 text-brand-950 text-sm font-semibold rounded-lg hover:bg-brand-400 transition-all"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
