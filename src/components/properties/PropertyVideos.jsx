import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Video, Link2, Upload, Trash2, Loader2, Plus, ExternalLink, Film } from 'lucide-react';
import { toast } from 'sonner';
import { parseVideoUrl, isLikelyUrl } from '../../utils/videoEmbed';

const rowId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

/**
 * Property video manager. Stores hosted links (YouTube/Vimeo/Loom) or uploaded
 * files on `property.videos`. Links embed in an iframe; uploads play via <video>.
 * Add (link or upload) and delete write the whole list back via setPropertyVideos.
 */
export function PropertyVideos({ property }) {
  const videos = property.videos ?? [];
  const uploadIds = videos.filter((v) => v.kind === 'upload' && v.storageId).map((v) => v.storageId);
  const resolved = useQuery(api.imExtraction.getPhotoUrls, uploadIds.length ? { ids: uploadIds } : 'skip');
  const urlById = Object.fromEntries((resolved ?? []).map((r) => [r.id, r.url]));

  const setVideos        = useMutation(api.properties.setPropertyVideos);
  const generateUploadUrl = useMutation(api.imExtraction.generateUploadUrl);

  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl]   = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const save = (next) => setVideos({ id: property._id, videos: next });

  const addLink = async () => {
    const url = linkUrl.trim();
    if (!isLikelyUrl(url)) { toast.error('Enter a valid video URL'); return; }
    try {
      await save([...videos, { id: rowId(), kind: 'link', url, title: linkTitle.trim() || undefined, addedAt: Date.now() }]);
      setLinkUrl(''); setLinkTitle(''); setShowLink(false);
      toast.success('Video added');
    } catch { toast.error('Failed to add video'); }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('video/'));
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const added = [];
      for (const f of files) {
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
        if (!res.ok) throw new Error('upload failed');
        const { storageId } = await res.json();
        added.push({ id: rowId(), kind: 'upload', storageId, title: f.name, addedAt: Date.now() });
      }
      await save([...videos, ...added]);
      toast.success(`Uploaded ${added.length} video${added.length > 1 ? 's' : ''}`);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const remove = async (id) => {
    try { await save(videos.filter((v) => v.id !== id)); }
    catch { toast.error('Failed to remove video'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <input ref={fileRef} type="file" accept="video/*" multiple hidden onChange={handleUpload} />

      {/* Header + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-brand-500" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-brand-500">
            Videos{videos.length ? ` · ${videos.length}` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLink((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
              showLink ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                       : 'bg-white/[0.03] border-white/[0.08] text-brand-100/60 hover:text-brand-100/90'
            }`}>
            <Link2 className="w-3.5 h-3.5" /> Add link
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white/[0.03] border border-white/[0.08] text-brand-100/60 hover:text-brand-100/90 transition-colors disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Add-link form */}
      {showLink && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLink()}
            placeholder="Paste a YouTube, Vimeo or Loom link…" autoFocus
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-brand-100/90 placeholder:text-brand-100/35 focus:outline-none focus:border-brand-500/40 transition-colors" />
          <div className="flex items-center gap-2">
            <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
              placeholder="Title (optional)"
              className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3.5 py-2 text-sm text-brand-100/90 placeholder:text-brand-100/35 focus:outline-none focus:border-brand-500/40 transition-colors" />
            <button onClick={addLink}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-brand-950 hover:bg-brand-400 transition-colors">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {linkUrl && !parseVideoUrl(linkUrl) && isLikelyUrl(linkUrl) && (
            <p className="text-[11px] text-amber-400/70">Not a YouTube/Vimeo/Loom link — it'll be saved as an open-in-new-tab link.</p>
          )}
        </div>
      )}

      {/* Grid / empty state */}
      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] py-16 text-center">
          <Film className="w-8 h-8 text-brand-100/30 mx-auto mb-3" />
          <p className="text-sm text-brand-100/45">No videos yet</p>
          <p className="text-xs text-brand-100/35 mt-1">Add a walkthrough link or upload a clip — clients see these in their deal view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((vid) => (
            <VideoCard key={vid.id} vid={vid} src={vid.kind === 'upload' ? urlById[vid.storageId] : undefined}
              loading={vid.kind === 'upload' && resolved === undefined} onRemove={() => remove(vid.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A single video tile — iframe embed for links, <video> for uploads. */
export function VideoCard({ vid, src, loading, onRemove }) {
  const embed = vid.kind === 'link' ? parseVideoUrl(vid.url) : null;
  return (
    <div className="group rounded-xl overflow-hidden border border-white/[0.07] bg-[#0A0A0A]">
      <div className="relative aspect-video bg-black">
        {vid.kind === 'upload' ? (
          loading ? (
            <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-5 h-5 text-brand-500 animate-spin" /></div>
          ) : src ? (
            <video src={src} controls preload="metadata" className="w-full h-full object-contain bg-black" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-brand-100/40">Video unavailable</div>
          )
        ) : embed ? (
          <iframe src={embed.embedUrl} title={vid.title || 'Video'} loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen className="w-full h-full" />
        ) : (
          <a href={vid.url} target="_blank" rel="noreferrer"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-100/60 hover:text-brand-400 transition-colors">
            <ExternalLink className="w-6 h-6" />
            <span className="text-xs">Open video</span>
          </a>
        )}
        {onRemove && (
          <button onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[#0A0A0A]/80 text-brand-100/70 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" aria-label="Delete video">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {(vid.title || embed) && (
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-brand-100/35 shrink-0">
            {vid.kind === 'upload' ? 'Upload' : embed?.provider ?? 'Link'}
          </span>
          <p className="text-sm text-brand-100/75 truncate">{vid.title || 'Untitled'}</p>
        </div>
      )}
    </div>
  );
}
