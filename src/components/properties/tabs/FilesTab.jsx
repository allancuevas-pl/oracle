import React, { useRef, useState } from 'react';
import { CustomSelect } from '../../ui/CustomSelect';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Upload, FileText, Download, Trash2, Loader2, Lock, Eye, FolderLock } from 'lucide-react';
import { Spinner } from '../../ui/Loading';
import { formatDate, formatFileSize } from '../../../utils/format';
import { toast } from 'sonner';
import { rowProps } from '../../../utils/rowProps';

const CATEGORIES = ['Contract', 'Loan', 'Legal', 'DD', 'Other'];

/**
 * Deal Vault — sensitive deal documents on a property (loan papers, legal,
 * contracts, DD). Each file is Internal (staff-only) or Client-visible.
 * Staff upload / retag / delete here; client-portal surfacing is a follow-up.
 */
export function FilesTab({ property }) {
  const propertyId = property?._id;
  const files = useQuery(api.dealFiles.listForProperty, propertyId ? { propertyId } : 'skip');
  const generateUploadUrl = useMutation(api.dealFiles.generateUploadUrl);
  const addFile = useMutation(api.dealFiles.addFile);
  const updateFile = useMutation(api.dealFiles.updateFile);
  const deleteFile = useMutation(api.dealFiles.deleteFile);

  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const handleFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      try {
        const url = await generateUploadUrl();
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = await res.json();
        // New files default to Internal — sensitive until explicitly shared.
        await addFile({ propertyId, storageId, fileName: file.name, contentType: file.type || undefined, size: file.size || undefined, visibility: 'internal' });
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${err.message || 'upload failed'}`);
      }
    }
    if (ok) toast.success(`${ok} file${ok !== 1 ? 's' : ''} added to the vault`);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };

  const toggleVisibility = async (f) => {
    try {
      await updateFile({ id: f._id, visibility: f.visibility === 'internal' ? 'client' : 'internal' });
    } catch (err) { toast.error(err.message || 'Update failed'); }
  };
  const setCategory = async (f, category) => {
    try { await updateFile({ id: f._id, category: category || undefined }); }
    catch (err) { toast.error(err.message || 'Update failed'); }
  };
  const handleDelete = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    try { await deleteFile({ id }); toast.success('File deleted'); }
    catch (err) { toast.error(err.message || 'Delete failed'); }
    finally { setConfirmId(null); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500 flex items-center gap-2">
            <FolderLock className="w-4 h-4" /> Deal Vault
          </h2>
          <p className="text-xs text-brand-100/40 mt-1">
            Sensitive deal documents. <span className="text-brand-100/60">Internal</span> files are staff-only;
            <span className="text-emerald-400/80"> Client-visible</span> files can be shared to the portal.
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-brand-900/30 text-brand-400 text-xs font-bold border border-brand-800/50 shrink-0">
          {files?.length ?? 0} FILE{files?.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* Dropzone */}
      <div
        {...rowProps(() => inputRef.current?.click(), 'Choose files to upload')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-brand-500/50 bg-brand-500/[0.04]' : 'border-white/[0.08] bg-white/[0.01] hover:border-brand-500/20 hover:bg-brand-500/[0.02]'}`}
      >
        {uploading ? <Loader2 className="w-7 h-7 text-brand-400 mx-auto mb-2 animate-spin" /> : <Upload className="w-7 h-7 text-brand-100/40 mx-auto mb-2" />}
        <p className="text-sm font-medium text-brand-100/60">{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</p>
        <p className="text-xs text-brand-100/35 mt-1">New files are Internal by default. Up to 25MB each.</p>
      </div>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      {/* List */}
      {files === undefined ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : files.length === 0 ? (
        <div className="border border-brand-800/30 rounded-lg bg-[#111] p-10 text-center flex flex-col items-center">
          <FileText className="w-6 h-6 text-brand-500/40 mb-3" />
          <p className="text-sm text-brand-100/50">Vault is empty</p>
          <p className="text-xs text-brand-100/35 mt-1 max-w-xs">Loan papers, contracts, legal records and DD materials for this deal live here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => {
            const size = formatFileSize(f.size);
            const isClient = f.visibility === 'client';
            return (
              <div key={f._id} className="flex items-center gap-3 border border-brand-800/50 rounded-lg bg-[#111] p-3 hover:border-brand-500/30 transition-colors">
                <div className="w-9 h-9 rounded-md bg-brand-900/30 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-brand-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-50 truncate">{f.fileName}</p>
                  <p className="text-xs text-brand-100/40">{formatDate(f.uploadedAt)}{size ? ` · ${size}` : ''}</p>
                </div>

                {/* Category */}
                <div className="hidden sm:block w-40">
                  <CustomSelect
                    variant="compact"
                    ariaLabel={`Category for ${f.name}`}
                    value={f.category || ''}
                    onChange={(v) => setCategory(f, v)}
                    placeholder="Uncategorised"
                    options={[{ value: '', label: 'Uncategorised' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
                  />
                </div>

                {/* Visibility toggle */}
                <button
                  onClick={() => toggleVisibility(f)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${isClient ? 'text-emerald-400 bg-emerald-900/15 border-emerald-800/40 hover:bg-emerald-900/25' : 'text-brand-100/55 bg-white/[0.03] border-white/[0.08] hover:text-brand-100'}`}
                  title={isClient ? 'Client-visible — click to make Internal' : 'Internal (staff only) — click to make Client-visible'}
                >
                  {isClient ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {isClient ? 'Client' : 'Internal'}
                </button>

                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-brand-100/50 hover:text-brand-400 hover:bg-brand-900/30 transition-colors" title="Download">
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(f._id)}
                  className={`p-1.5 rounded-md transition-colors ${confirmId === f._id ? 'text-red-400 bg-red-500/10' : 'text-brand-100/50 hover:text-red-400 hover:bg-red-500/10'}`}
                  title={confirmId === f._id ? 'Click again to confirm delete' : 'Delete'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
