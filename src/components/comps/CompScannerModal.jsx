import React, { useState, useRef } from 'react';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Loader2, ScanLine, Upload, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,application/pdf,image/png,image/jpeg,image/webp';

/**
 * Spreadsheets can't be sent to the model as a document — the API takes PDFs
 * and images only. Will works in Excel (2026-09-02: "I can't upload Excel"),
 * so a workbook is read in the browser, flattened to a tab-separated table and
 * sent down the existing pasted-text path. Same extraction, no new backend.
 */
const isSpreadsheet = (f) => /\.(xlsx|xls|csv)$/i.test(f?.name || '');

/** Rows -> TSV. Tabs survive commas inside addresses; the model reads either. */
const rowsToText = (rows) =>
  rows
    .map((r) => r.map((c) => (c == null ? '' : String(c).trim())).join('\t'))
    .filter((line) => line.replace(/\t/g, '').length > 0)
    .join('\n');

async function spreadsheetToText(file) {
  if (/\.csv$/i.test(file.name)) return (await file.text()).trim();

  // Loaded on demand — only needed when a workbook is actually dropped.
  const { default: readXlsxFile } = await import('read-excel-file/browser');

  // One call returns every sheet with its rows: [{ sheet, data: [[cell,...]] }].
  const sheets = await readXlsxFile(file, { getSheets: true });

  // Keep every sheet and label it with its tab name. Will's workbooks split
  // leasing and sales across tabs, and the tab name is often the only thing
  // saying which is which — dropping it would make the model guess the type.
  return sheets
    .map(({ sheet, data }) => {
      const body = rowsToText(data || []);
      return body ? `# Sheet: ${sheet}\n${body}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
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
  const [dragOver, setDragOver] = useState(false);

  const reset = () => { setFile(null); setText(''); setComps(null); setSelected(new Set()); setScanning(false); setImporting(false); setDragOver(false); };

  // Will asked for drag-and-drop alongside the file picker (2026-09-02).
  const accepts = (f) => isSpreadsheet(f) || /^(application\/pdf|image\/)/.test(f?.type || '');
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!accepts(f)) { toast.error('Drop a PDF, image, or spreadsheet (.xlsx / .csv).'); return; }
    setFile(f);
  };
  const close = () => { reset(); onClose(); };

  const scan = async () => {
    if (!file && !text.trim()) { toast.error('Add a file or paste a table first.'); return; }
    setScanning(true);
    try {
      let storageId, mediaType;
      let payloadText = text.trim();

      if (file && isSpreadsheet(file)) {
        const sheetText = await spreadsheetToText(file);
        if (!sheetText) throw new Error('That spreadsheet looks empty.');
        // Anything pasted as well is kept — it's usually context for the table.
        payloadText = [payloadText, sheetText].filter(Boolean).join('\n\n');
      } else if (file) {
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
        ({ storageId } = await res.json());
        mediaType = file.type;
      }

      const result = await extractComps({ storageId, mediaType, text: payloadText || undefined });
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
            className={`bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full ${comps ? 'max-w-6xl' : 'max-w-3xl'} flex flex-col relative z-10 backdrop-blur-md max-h-[85vh] transition-[max-width] duration-200`}
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

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`w-full cursor-pointer border border-dashed rounded-lg p-6 flex flex-col items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
                    dragOver ? 'border-brand-500/60 bg-brand-500/[0.07]'
                    : file   ? 'border-brand-500/40 bg-brand-500/[0.04]'
                             : 'border-brand-800/50 hover:border-brand-500/30 hover:bg-white/[0.02]'
                  }`}
                >
                  {file ? <FileText className="w-6 h-6 text-brand-400" /> : <Upload className="w-6 h-6 text-brand-100/40" />}
                  <span className="text-sm text-brand-100/70">
                    {file ? file.name : dragOver ? 'Drop it here' : 'Drop a file here, or click to choose'}
                  </span>
                  <span className="text-xs text-brand-100/40">
                    {file
                      ? (isSpreadsheet(file) ? 'Spreadsheet · ready to scan' : 'Ready to scan')
                      : 'Excel, CSV, PDF or image'}
                  </span>
                </div>
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
                  <table className="w-full min-w-[900px] text-sm text-left">
                    <thead className="text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50 sticky top-0 border-b border-brand-800/30 z-10">
                      <tr>
                        <th className="px-3 py-3 w-8"></th>
                        <th className="px-3 py-3 font-semibold">Type</th>
                        <th className="px-3 py-3 font-semibold">Address</th>
                        <th className="px-3 py-3 font-semibold">Suburb</th>
                        <th className="px-3 py-3 font-semibold">State</th>
                        <th className="px-3 py-3 font-semibold">Asset / Grade</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">NLA / Build</th>
                        <th className="px-3 py-3 font-semibold">Land</th>
                        <th className="px-3 py-3 font-semibold">Rent / Price</th>
                        <th className="px-3 py-3 font-semibold">Date</th>
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
                          <td className="px-3 py-2.5 text-brand-100/50 tabular-nums whitespace-nowrap">{c.nlaSqm ? `${c.nlaSqm.toLocaleString()} m²` : '—'}</td>
                          <td className="px-3 py-2.5 text-brand-100/50 tabular-nums whitespace-nowrap">{c.landAreaSqm ? `${c.landAreaSqm.toLocaleString()} m²` : '—'}</td>
                          <td className="px-3 py-2.5 text-brand-100/80 font-medium whitespace-nowrap">{metric(c)}</td>
                          <td className="px-3 py-2.5 text-brand-100/50 tabular-nums whitespace-nowrap">{c.saleDate || c.leaseDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-brand-800/30 flex justify-between items-center">
                  <span className="text-xs text-brand-100/40">Untick anything wrong. Fine-tune individual comps after import via the comp editor.</span>
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
