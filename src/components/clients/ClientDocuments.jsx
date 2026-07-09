import React, { useRef, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Upload, FileText, Download, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import { Spinner } from '../ui/Loading';
import { formatDate, formatFileSize } from '../../utils/format';
import { toast } from 'sonner';

/**
 * Staff-side AML / compliance document manager for a client record.
 * Upload (browser -> Convex storage) + list + delete. The client sees these
 * same files (read-only) in their portal. Lives in the ClientView center column.
 */
export function ClientDocuments({ clientId }) {
  const docs = useQuery(api.clientDocuments.listForClient, clientId ? { clientId } : 'skip');
  const generateUploadUrl = useMutation(api.clientDocuments.generateUploadUrl);
  const addDocument = useMutation(api.clientDocuments.addDocument);
  const deleteDocument = useMutation(api.clientDocuments.deleteDocument);

  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of files) {
      try {
        const url = await generateUploadUrl();
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const { storageId } = await res.json();
        await addDocument({
          clientId,
          storageId,
          fileName: file.name,
          contentType: file.type || undefined,
          size: file.size || undefined,
        });
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${err.message || 'upload failed'}`);
      }
    }
    if (ok > 0) toast.success(`${ok} document${ok !== 1 ? 's' : ''} uploaded`);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (id) => {
    if (confirmId !== id) { setConfirmId(id); return; }
    try {
      await deleteDocument({ id });
      toast.success('Document deleted');
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Compliance Documents
        </h2>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-brand-900/30 text-brand-400 text-xs font-bold border border-brand-800/50">
            {docs?.length ?? 0} FILE{docs?.length !== 1 ? 'S' : ''}
          </span>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-brand-500/10 border border-brand-500/25 hover:bg-brand-500/20 text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
            title="Upload AML / compliance documents"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      <p className="text-xs text-brand-100/40 -mt-1">
        Uploaded by the team. The client can view and download these in their portal.
      </p>

      {docs === undefined ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : docs.length === 0 ? (
        <div className="border border-brand-800/30 rounded-lg bg-[#111] p-10 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-brand-900/30 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-brand-500/50" />
          </div>
          <h3 className="text-brand-50 font-medium mb-1 text-sm">No documents yet</h3>
          <p className="text-xs text-brand-100/40 max-w-xs">
            Upload the client's AML / compliance documents. They will appear in the client's portal.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const size = formatFileSize(doc.size);
            return (
              <div
                key={doc._id}
                className="flex items-center gap-3 border border-brand-800/50 rounded-lg bg-[#111] p-3 hover:border-brand-500/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-md bg-brand-900/30 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-brand-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-50 truncate">{doc.fileName}</p>
                  <p className="text-xs text-brand-100/40">
                    {formatDate(doc.uploadedAt)}{size ? ` · ${size}` : ''}
                  </p>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md text-brand-100/50 hover:text-brand-400 hover:bg-brand-900/30 transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleDelete(doc._id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    confirmId === doc._id
                      ? 'text-red-400 bg-red-500/10'
                      : 'text-brand-100/50 hover:text-red-400 hover:bg-red-500/10'
                  }`}
                  title={confirmId === doc._id ? 'Click again to confirm delete' : 'Delete'}
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
