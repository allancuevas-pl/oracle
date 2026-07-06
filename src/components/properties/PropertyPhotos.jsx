import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Image as ImageIcon, X, Loader2, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Property photo gallery + manager. Resolves Convex storage IDs to URLs, renders
 * a hero + thumbnail strip with a keyboard lightbox (← / → / Esc), and — when
 * given a `propertyId` or `extractionId` — supports adding (upload) and deleting
 * photos. For a property with a linked IM and no photos, offers backfill.
 *
 * Photos live on the property (propertyId) or, in the scan result, on the
 * extraction (extractionId). Add/delete write back to whichever target is set.
 */
export function PropertyPhotos({ photoIds, propertyId, extractionId }) {
  const ids = photoIds ?? [];
  const editable = !!(propertyId || extractionId);
  const photos = useQuery(api.imExtraction.getPhotoUrls, ids.length ? { ids } : 'skip');
  const [active, setActive] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const fileRef = useRef(null);

  const generateUploadUrl   = useMutation(api.imExtraction.generateUploadUrl);
  const setPropertyPhotos   = useMutation(api.properties.setPropertyPhotos);
  const attachExtractionPhotos = useMutation(api.imExtraction.attachExtractionPhotos);

  const linkedIm = useQuery(
    api.imExtraction.getExtractionForProperty,
    !ids.length && propertyId ? { propertyId } : 'skip',
  );
  const imUrl = useQuery(
    api.imExtraction.getPhotoUrls,
    linkedIm?.storageId ? { ids: [linkedIm.storageId] } : 'skip',
  );

  const count = photos?.length ?? 0;
  const close = useCallback(() => setActive(null), []);
  const next = useCallback(() => setActive((i) => (i === null ? i : (i + 1) % count)), [count]);
  const prev = useCallback(() => setActive((i) => (i === null ? i : (i - 1 + count) % count)), [count]);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close, next, prev]);

  // Persist a new photoId list to whichever target this gallery manages.
  const saveIds = async (newIds) => {
    if (propertyId) await setPropertyPhotos({ id: propertyId, photoIds: newIds });
    else if (extractionId) await attachExtractionPhotos({ id: extractionId, photoIds: newIds });
  };

  const uploadOne = async (file) => {
    const url = await generateUploadUrl();
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
    if (!res.ok) throw new Error('upload failed');
    return (await res.json()).storageId;
  };

  const handleAddFiles = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = ''; // allow re-selecting the same file
    if (!files.length) return;
    setUploading(true);
    try {
      const newIds = [];
      for (const f of files) newIds.push(await uploadOne(f));
      await saveIds([...ids, ...newIds]);
      toast.success(`Added ${newIds.length} photo${newIds.length > 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to add photos');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (storageId) => {
    try {
      await saveIds(ids.filter((x) => x !== storageId));
    } catch {
      toast.error('Failed to remove photo');
    }
  };

  const handleBackfill = async () => {
    const url = imUrl?.[0]?.url;
    if (!url || !propertyId) return;
    setPulling(true);
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'im.pdf', { type: 'application/pdf' });
      const { extractPhotosFromPdf } = await import('../../utils/pdfPhotos');
      const blobs = await extractPhotosFromPdf(file, { max: 12 });
      const newIds = [];
      for (const b of blobs) newIds.push(await uploadOne(b));
      if (newIds.length) {
        await setPropertyPhotos({ id: propertyId, photoIds: newIds });
        toast.success(`Pulled ${newIds.length} photo${newIds.length > 1 ? 's' : ''} from the IM`);
      } else toast.info('No photos found in this IM');
    } catch {
      toast.error('Could not pull photos from the IM');
    } finally {
      setPulling(false);
    }
  };

  const AddButton = () => (
    <button
      onClick={() => fileRef.current?.click()}
      disabled={uploading}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-white/[0.03] border border-white/[0.08] text-brand-100/60 hover:text-brand-100/90 hover:border-white/[0.15] transition-colors disabled:opacity-50"
    >
      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
      Add
    </button>
  );

  const fileInput = editable && (
    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleAddFiles} />
  );

  // ── Empty state ──
  if (!ids.length) {
    if (!editable) return null;
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        {fileInput}
        <div className="flex items-center gap-2 text-xs text-brand-100/45">
          <ImageIcon className="w-4 h-4 text-brand-100/30" />
          {linkedIm ? 'No photos yet — this property has a scanned IM.' : 'No photos yet.'}
        </div>
        <div className="flex items-center gap-2">
          {propertyId && linkedIm && (
            <button onClick={handleBackfill} disabled={pulling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-brand-500/10 border border-brand-500/25 text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-50 whitespace-nowrap">
              {pulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {pulling ? 'Pulling…' : 'Pull from IM'}
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white/[0.03] border border-white/[0.08] text-brand-100/60 hover:text-brand-100/90 transition-colors disabled:opacity-50 whitespace-nowrap">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add photos
          </button>
        </div>
      </div>
    );
  }

  const thumbBtn = (p, idx) => (
    <div key={p.id} className="relative group rounded-lg overflow-hidden border border-white/[0.06]">
      <button onClick={() => setActive(idx)} className="block w-full">
        <img src={p.url} alt="Property" loading="lazy"
          className="w-full h-14 object-cover group-hover:scale-105 transition-transform duration-300" />
      </button>
      {editable && (
        <button onClick={(e) => { e.stopPropagation(); handleRemove(p.id); }}
          className="absolute top-0.5 right-0.5 p-0.5 rounded bg-[#0A0A0A]/70 text-brand-100/60 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" aria-label="Delete photo">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {fileInput}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-brand-500" />
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
            Photos{photos ? ` · ${count}` : ''}
          </h3>
        </div>
        {editable && <AddButton />}
      </div>

      {photos === undefined ? (
        <div className="flex items-center justify-center h-40 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
        </div>
      ) : count === 0 ? null : (
        <div className="space-y-2">
          {/* Hero */}
          <div className="relative group">
            <button onClick={() => setActive(0)} className="block w-full overflow-hidden rounded-xl border border-white/[0.06]">
              <img src={photos[0].url} alt="Property" loading="lazy"
                className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform duration-300" />
            </button>
            {editable && (
              <button onClick={(e) => { e.stopPropagation(); handleRemove(photos[0].id); }}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-[#0A0A0A]/70 text-brand-100/70 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" aria-label="Delete photo">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {count > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
              {photos.slice(1).map((p, j) => thumbBtn(p, j + 1))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {active !== null && photos?.[active] && (
        <div onClick={close}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050505]/92 backdrop-blur-sm p-6 select-none">
          <button onClick={close} className="absolute top-5 right-5 text-brand-100/60 hover:text-white transition-colors" aria-label="Close">
            <X className="w-6 h-6" />
          </button>
          {count > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 sm:left-8 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-brand-100/70 hover:text-white transition-colors" aria-label="Previous">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-4 sm:right-8 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-brand-100/70 hover:text-white transition-colors" aria-label="Next">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img src={photos[active].url} alt="Property"
            className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-medium tabular-nums text-brand-100/60 bg-[#0A0A0A]/70 border border-white/[0.06] rounded-full px-3 py-1">
            {active + 1} / {count}
          </div>
        </div>
      )}
    </div>
  );
}
