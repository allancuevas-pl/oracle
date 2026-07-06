import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Scan, Loader2, AlertCircle, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { ExtractionView } from '../components/oracle/ExtractionView';
import { Spinner } from '../components/ui/Loading';
import { extractPhotosFromPdf } from '../utils/pdfPhotos';

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export function OracleScanner() {
  const [phase, setPhase] = useState('drop'); // drop | uploading | extracting | complete | error
  const [extractionId, setExtractionId] = useState(null);
  const [filename, setFilename] = useState(null);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('idle'); // idle | extracting | done | none
  const fileRef = useRef(null);

  const generateUploadUrl  = useMutation(api.imExtraction.generateUploadUrl);
  const createPending      = useMutation(api.imExtraction.createPendingExtraction);
  const attachPhotos       = useMutation(api.imExtraction.attachExtractionPhotos);
  const extractIM          = useAction(api.imExtractionAction.extractIM);
  const recentExtractions  = useQuery(api.imExtraction.getExtractions, {});

  // Pull photos out of the IM (browser-side), upload each, attach to the extraction.
  // Best-effort and fully decoupled from the Claude text extraction — failures here
  // never block the scan.
  const extractAndAttachPhotos = async (file, exId) => {
    setPhotoStatus('extracting');
    try {
      const blobs = await extractPhotosFromPdf(file, { max: 12 });
      if (!blobs.length) { setPhotoStatus('none'); return; }
      const ids = [];
      for (const blob of blobs) {
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        if (res.ok) ids.push((await res.json()).storageId);
      }
      if (ids.length) await attachPhotos({ id: exId, photoIds: ids });
      setPhotoStatus(ids.length ? 'done' : 'none');
    } catch (err) {
      setPhotoStatus('none');
      // Photos are a bonus and never block the scan, but log so failures are visible.
      console.warn('[photos] extraction failed:', err);
    }
  };

  // Subscribe to the active extraction — Convex will push updates when the action completes
  const extraction = useQuery(
    api.imExtraction.getExtraction,
    extractionId ? { id: extractionId } : 'skip'
  );

  useEffect(() => {
    if (!extraction) return;
    if (extraction.status === 'complete' && phase === 'extracting') setPhase('complete');
    if (extraction.status === 'failed' && phase === 'extracting') {
      setError(extraction.error || 'Extraction failed');
      setPhase('error');
    }
  }, [extraction?.status]);

  const handleFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file (.pdf)');
      setPhase('error');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File is too large — maximum 50MB');
      setPhase('error');
      return;
    }

    setFilename(file.name);
    setError(null);
    setPhase('uploading');

    try {
      // 1. Get a short-lived upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // 2. Upload the PDF directly to Convex storage
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
      const { storageId } = await res.json();

      // 3. Create the pending extraction record — UI subscribes to this via useQuery
      const id = await createPending({ storageId, filename: file.name });
      setExtractionId(id);
      setPhase('extracting');

      // 4. Trigger the extraction action — fire and forget.
      //    The action updates the DB record; the reactive query handles the UI update.
      extractIM({ extractionId: id, storageId }).catch((err) => {
        setError(err.message);
        setPhase('error');
      });

      // 5. In parallel, pull photos out of the IM and attach them (best-effort).
      extractAndAttachPhotos(file, id);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('drop');
    setExtractionId(null);
    setFilename(null);
    setError(null);
    setPhotoStatus('idle');
  };

  const openExisting = (ex) => {
    setExtractionId(ex._id);
    setPhotoStatus('idle'); // existing scan — rely on stored photoIds, not a live run
    if (ex.status === 'complete') setPhase('complete');
    else if (ex.status === 'failed') { setError(ex.error || 'Failed'); setPhase('error'); }
    else setPhase('extracting');
  };

  // Full-screen extraction view
  if (phase === 'complete' && extraction?.status === 'complete') {
    return <ExtractionView extraction={extraction} onReset={handleReset} photoStatus={photoStatus} />;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">

      {/* Page header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">Pillar II</p>
        <h1 className="text-2xl font-semibold text-white">Oracle Scanner</h1>
        <p className="text-sm text-brand-100/40 mt-1">
          Drop an Information Memorandum PDF. Get structured property data back in seconds.
        </p>
      </div>

      {/* Drop zone */}
      {phase === 'drop' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setHover(true); }}
          onDragLeave={() => setHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setHover(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-xl py-20 text-center transition-all ${
            hover
              ? 'border-brand-500/60 bg-brand-500/[0.04]'
              : 'border-brand-800/40 hover:border-brand-500/30 bg-white/[0.01]'
          }`}
        >
          <Scan className={`w-8 h-8 mx-auto mb-4 transition-colors ${hover ? 'text-brand-500' : 'text-brand-100/40'}`} />
          <p className="text-sm font-medium text-brand-100/60 mb-1">Drop a PDF here</p>
          <p className="text-xs text-brand-100/45">or click to choose · up to 50MB</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </div>
      )}

      {/* Uploading / Extracting */}
      {(phase === 'uploading' || phase === 'extracting') && (
        <div className="border border-white/[0.06] rounded-xl py-20 text-center bg-[#0A0A0A]">
          <Spinner className="w-8 h-8 mb-4" />
          <p className="text-sm font-medium text-brand-50 mb-1.5">
            {phase === 'uploading' ? 'Uploading…' : 'Reading IM…'}
          </p>
          <p className="text-xs text-brand-100/45">
            {phase === 'uploading'
              ? filename
              : 'Calling Claude · usually 10–30 seconds depending on size'}
          </p>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/[0.04]">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400 mb-0.5">Extraction failed</p>
              <p className="text-xs text-brand-100/50 leading-relaxed">{error}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-brand-500 hover:text-brand-400 transition-colors"
          >
            Try another IM →
          </button>
        </div>
      )}

      {/* Recent scans */}
      {phase === 'drop' && recentExtractions && recentExtractions.length > 0 && (
        <div className="mt-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 mb-3">
            Recent Scans
          </p>
          <div className="space-y-1">
            {recentExtractions.slice(0, 8).map((ex) => {
              const statusIcon = ex.status === 'complete'
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                : ex.status === 'failed'
                ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                : <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin shrink-0" />;

              // Parse address if complete
              let subtitle = ex.status === 'failed' ? 'Failed' : ex.status === 'processing' ? 'Processing…' : '';
              if (ex.status === 'complete' && ex.result) {
                try {
                  const parsed = JSON.parse(ex.result);
                  subtitle = parsed.subject_property?.address?.full || ex.filename;
                } catch { subtitle = ex.filename; }
              }

              return (
                <button
                  key={ex._id}
                  onClick={() => openExisting(ex)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-colors text-left"
                >
                  {statusIcon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-100/70 truncate">{ex.filename}</p>
                    {subtitle && subtitle !== ex.filename && (
                      <p className="text-xs text-brand-100/45 truncate mt-0.5">{subtitle}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-brand-100/40 shrink-0">{timeAgo(ex._creationTime)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-100/40 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
