import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { RecordWorkspace } from '../components/layout/RecordWorkspace';
import { ClientModal } from '../components/clients/ClientModal';
import { Loader2, Mail, Phone, Building, FileText, Plus, Tag, Pencil, MoreHorizontal, Trash2 } from 'lucide-react';
import { IconButton } from '../components/ui/IconButton';

const formatCurrency = (val) => {
  if (!val) return null;
  if (val >= 1000000) return "$" + (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  return "$" + val.toLocaleString();
};

const ROLE_LABELS = {
  buyer: 'Buyer',
  seller: 'Seller',
  vendor: 'Vendor',
  other: 'Other',
};

const ROLE_COLOURS = {
  buyer: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  seller: 'bg-green-500/10 text-green-400 border-green-500/20',
  vendor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  other: 'bg-brand-800/10 text-brand-100/50 border-brand-800/20',
};

export function ClientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const client = useQuery(api.clients.getClient, id ? { id } : "skip");
  const briefs = useQuery(api.briefs.getBriefsByClient, id ? { clientId: id } : "skip");

  if (client === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="text-center mt-20">
        <p className="text-brand-100/50">Client not found.</p>
        <button onClick={() => navigate('/clients')} className="mt-4 text-brand-500 hover:text-brand-400 text-sm">
          Back to Clients
        </button>
      </div>
    );
  }

  const initials = client.name
    ?.split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <>
      <RecordWorkspace
        title={client.name}
        subtitle={[client.company, client.role ? ROLE_LABELS[client.role] : null].filter(Boolean).join(' · ')}
        onBack={() => navigate('/clients')}
        actions={
          <IconButton icon={Pencil} label="Edit Client" onClick={() => setIsEditModalOpen(true)} />
        }
        leftColumn={
          <div className="space-y-6">
            {/* Avatar + name */}
            <div className="flex items-center space-x-4 pb-5 border-b border-white/5">
              <div className="w-14 h-14 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-semibold text-brand-400">{initials}</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-brand-50">{client.name}</h2>
                {client.role && (
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${ROLE_COLOURS[client.role] ?? ROLE_COLOURS.other}`}>
                    {ROLE_LABELS[client.role] ?? client.role}
                  </span>
                )}
              </div>
            </div>

            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Contact Details</h3>

            <div className="space-y-4">
              {client.company && (
                <div className="flex items-start space-x-3">
                  <Building className="w-4 h-4 text-brand-100/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-brand-100/40 mb-0.5">Company</p>
                    <p className="text-sm text-brand-50">{client.company}</p>
                  </div>
                </div>
              )}
              {client.email && (
                <div className="flex items-start space-x-3">
                  <Mail className="w-4 h-4 text-brand-100/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-brand-100/40 mb-0.5">Email</p>
                    <a href={`mailto:${client.email}`} className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                      {client.email}
                    </a>
                  </div>
                </div>
              )}
              {client.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="w-4 h-4 text-brand-100/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-brand-100/40 mb-0.5">Phone</p>
                    <a href={`tel:${client.phone}`} className="text-sm text-brand-50 hover:text-brand-400 transition-colors">
                      {client.phone}
                    </a>
                  </div>
                </div>
              )}
              {!client.company && !client.email && !client.phone && (
                <p className="text-sm text-brand-100/30 italic">No contact details added yet.</p>
              )}
            </div>

            {client.notes && (
              <div className="pt-5 border-t border-white/5 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-500">Notes</h3>
                <p className="text-sm text-brand-100/70 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>
        }
        centerColumn={
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Linked Briefs</h2>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-full bg-brand-900/30 text-brand-400 text-xs font-bold border border-brand-800/50">
                  {briefs?.length ?? 0} BRIEF{briefs?.length !== 1 ? 'S' : ''}
                </span>
                <button
                  onClick={() => navigate('/briefs')}
                  className="p-1.5 rounded-md hover:bg-brand-900/30 text-brand-100/50 hover:text-brand-400 transition-colors border border-white/5"
                  title="Create new brief"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {briefs === undefined ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
              </div>
            ) : briefs.length === 0 ? (
              <div className="border border-brand-800/30 rounded-lg bg-[#111] p-10 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-brand-900/30 flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5 text-brand-500/50" />
                </div>
                <h3 className="text-brand-50 font-medium mb-1 text-sm">No briefs linked</h3>
                <p className="text-xs text-brand-100/40 max-w-xs">
                  When you create a brief and select this client, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {briefs.map((brief) => {
                  const startTime = brief.startDate ?? brief._creationTime ?? Date.now();
                  const daysOpen = Math.floor((Date.now() - startTime) / (1000 * 60 * 60 * 24));
                  const budget = brief.budgetMin && brief.budgetMax
                    ? `${formatCurrency(brief.budgetMin)} – ${formatCurrency(brief.budgetMax)}`
                    : null;

                  return (
                    <div
                      key={brief._id}
                      onClick={() => navigate(`/briefs/${brief._id}`)}
                      className="border border-brand-800/50 rounded-lg bg-[#111] p-4 hover:border-brand-500/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            {brief.briefId && (
                              <span className="text-[10px] font-mono text-brand-500">{brief.briefId}</span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                              {brief.stage}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-brand-50 group-hover:text-brand-400 transition-colors">
                            {brief.assetTypes?.join(', ') || 'No asset type'}
                            {budget ? ` · ${budget}` : ''}
                          </p>
                          {brief.location?.length > 0 && (
                            <p className="text-xs text-brand-100/50 flex items-center">
                              <Tag className="w-3 h-3 mr-1" />
                              {brief.location.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <span className={`text-xs font-medium ${
                            brief.priority === 'High' ? 'text-red-400' :
                            brief.priority === 'Medium' ? 'text-yellow-400' :
                            'text-blue-400'
                          }`}>
                            {brief.priority || 'Low'}
                          </span>
                          <p className="text-xs text-brand-100/40 mt-1">{daysOpen}d open</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        }
        rightColumn={
          <div className="space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-500">Summary</h2>
            <div className="space-y-4">
              <div className="bg-[#111] border border-brand-800/30 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-brand-100/50">Total Briefs</span>
                  <span className="text-lg font-semibold text-brand-50">{briefs?.length ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-brand-100/50">Active</span>
                  <span className="text-sm font-medium text-brand-50">
                    {briefs?.filter(b => b.status === 'active').length ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-brand-100/50">Archived</span>
                  <span className="text-sm font-medium text-brand-100/50">
                    {briefs?.filter(b => b.status === 'archived').length ?? '—'}
                  </span>
                </div>
              </div>
              <div className="bg-[#111] border border-brand-800/30 rounded-lg p-4">
                <p className="text-xs text-brand-100/30 italic text-center">
                  Contact history coming soon.
                </p>
              </div>
            </div>
          </div>
        }
      />
      <ClientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editingClient={client}
      />
    </>
  );
}
