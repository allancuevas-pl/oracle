import React, { useState, useRef } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Loader2, ScanLine, Upload, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const fmt = (n) => (n ? (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${n.toLocaleString()}`) : '—');

export function CompScannerModal({ isOpen, onClose, onImported }) {
  const generateUploadUrl = useMutation(api.imExtraction.generateUploadUrl);
  const extractComps = useAction(api.compExtractionAction.extractComps);
  const createComps = useMutation(api.comps.createComps);
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [comps, setComps] = useState(null);        // null = input stage, [] = reviewed
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const reset = () => { setFile(null); setText(''); setComps(null); setSelected(new Set()); setScanning(false); setImporting(false); };
  const close = () => { reset(); onClose(); };

  const scan = async () => {
    if (!file && !text.trim()) { toast.error('Add a file or paste a table first.'); return; }
    setScanning(true);
    try {
      let storageId, mediaType;
      if (file) {
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
        ({ storageId } = await res.json());
        mediaType = file.type;
      }
      const result = await extractComps({ storageId, mediaType, text: text.trim() || undefined });
      if (!result.comps.length) { toast.error('No comps found. Try a clearer table or paste the text.'); setScanning(false); return; }
      setComps(result.comps);
      setSelected(new Set(result.comps.map((_, i) => i)));
      toast.success(`Found ${result.comps.length} comp${result.comps.length !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err?.message || 'Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const toggle = (i) => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  const doImport = async () => {
    const chosen = comps.filter((_, i) => selected.has(i));
    if (!chosen.length) { toast.error('Select at least one comp.'); return; }
    setImporting(true);
    try {
      await createComps({ comps: chosen });
      toast.success(`Imported ${chosen.length} comp${chosen.length !== 1 ? 's' : ''}`);
      onImported?.();
      close();
    } catch (err) {
      toast.error(err?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const metric = (c) => c.type === 'lease'
    ? (c.rentPa ? `${fmt(c.rentPa)}/pa` : c.rentPerSqm ? `$${Math.round(c.rentPerSqm)}/m²` : '—')
    : (c.salePrice ? fmt(c.salePrice) : c.capRate ? `${c.capRate}% cap` : '—');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm" onClick={close} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col relative z-10 backdrop-blur-md max-h-[85vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-medium text-brand-50 tracking-tight flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-brand-500" /> Scan Comps
              </h2>
              <button onClick={close} className="text-brand-100/50 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5"><X className="w-5 h-5" /></button>
            </div>

            {/* ── Input stage ── */}
            {comps === null && (
              <div className="p-6 space-y-4 overflow-y-auto">
                <p className="text-sm text-brand-100/50">Upload an agent's comp table (PDF or screenshot) or paste it as text. Claude extracts the comps for you to review before importing.</p>

                <button
                  onClick={() => fileRef.current?.click()}
                  className={`w-full border border-dashed rounded-lg p-6 flex flex-col items-center gap-2 transition-colors ${file ? 'border-brand-500/40 bg-brand-500/[0.04]' : 'border-brand-800/50 hover:border-brand-500/30 hover:bg-white/[0.02]'}`}
                >
                  {file ? <FileText className="w-6 h-6 text-brand-400" /> : <Upload className="w-6 h-6 text-brand-100/40" />}
                  <span className="text-sm text-brand-100/70">{file ? file.name : 'Click to upload a PDF or image'}</span>
                  {file && <span className="text-xs text-brand-500/60">Ready to scan</span>}
                </button>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} />

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[11px] uppercase tracking-wider text-brand-100/35">or paste text</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <textarea
                  value={text} onChange={(e) => setText(e.target.value)} rows={5}
                  placeholder="Paste a comp table here — e.g. address, suburb, NLA, rent/sale, date, agent..."
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 resize-none"
                />

                <div className="flex justify-end">
                  <button onClick={scan} disabled={scanning || (!file && !text.trim())}
                    className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2">
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                    {scanning ? 'Scanning…' : 'Scan'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Review stage ── */}
            {comps !== null && (
              <>
                <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
                  <button onClick={() => setComps(null)} className="text-sm text-brand-100/50 hover:text-brand-100 flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</button>
                  <span className="text-sm text-brand-100/50">{selected.size} of {comps.length} selected</span>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50 sticky top-0 border-b border-brand-800/30 z-10">
                      <tr>
                        <th className="px-3 py-3 w-8"></th>
                        <th className="px-3 py-3 font-semibold">Type</th>
                        <th className="px-3 py-3 font-semibold">Address</th>
                        <th className="px-3 py-3 font-semibold">Suburb</th>
                        <th className="px-3 py-3 font-semibold">State</th>
                        <th className="px-3 py-3 font-semibold">Asset / Grade</th>
                        <th className="px-3 py-3 font-semibold">NLA</th>
                        <th className="px-3 py-3 font-semibold">Rent / Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-800/20">
                      {comps.map((c, i) => (
                        <tr key={i} onClick={() => toggle(i)}
                          className={`cursor-pointer transition-colors ${selected.has(i) ? 'bg-brand-500/[0.04]' : 'opacity-50 hover:opacity-80'}`}>
                          <td className="px-3 py-2.5">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected.has(i) ? 'bg-brand-500 border-brand-500' : 'border-brand-800/60'}`}>
                              {selected.has(i) && <CheckCircle2 className="w-3 h-3 text-brand-950" />}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${c.type === 'lease' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{c.type}</span>
                          </td>
                          <td className="px-3 py-2.5 text-brand-100/80 max-w-[180px] truncate">{c.address || <span className="text-brand-100/30 italic">—</span>}</td>
                          <td className="px-3 py-2.5 text-brand-100/60">{c.suburb || '—'}</td>
                          <td className="px-3 py-2.5 text-brand-100/50">{c.state || '—'}</td>
                          <td className="px-3 py-2.5 text-brand-100/50">
                            {c.assetType || '—'}{c.grade ? <span className="ml-1 text-brand-400">· {c.grade}</span> : ''}
                          </td>
                          <td className="px-3 py-2.5 text-brand-100/50">{c.nlaSqm ? `${c.nlaSqm.toLocaleString()} m²` : '—'}</td>
                          <td className="px-3 py-2.5 text-brand-100/80 font-medium">{metric(c)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-brand-800/30 flex justify-between items-center">
                  <span className="text-xs text-brand-100/40">Fine-tune individual comps after import via the comp editor.</span>
                  <button onClick={doImport} disabled={importing || selected.size === 0}
                    className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2">
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Import {selected.size} comp{selected.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
