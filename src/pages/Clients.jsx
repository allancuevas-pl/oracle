import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Plus, Users, Search, Mail, Phone, Building, Loader2 } from 'lucide-react';
import { ClientModal } from '../components/clients/ClientModal';
import { motion, AnimatePresence } from 'framer-motion';

export function Clients() {
  const navigate = useNavigate();
  const clients = useQuery(api.clients.getClients);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = (clients ?? []).filter(c => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 h-full flex flex-col">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <Users className="w-6 h-6 mr-3 text-brand-500" />
            Clients
          </h1>
          <p className="text-sm text-brand-100/50 mt-1">Manage client contacts and link them to briefs.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center justify-center shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Client
        </button>
      </div>

      {/* Table Card */}
      <div className="flex-1 bg-[#0A0A0A] border border-brand-800/30 rounded-xl overflow-hidden flex flex-col shadow-xl">

        {/* Toolbar */}
        <div className="p-4 border-b border-brand-800/30 bg-[#111] flex items-center justify-between">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/30" />
            <input
              type="text"
              placeholder="Search name, company, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md pl-9 pr-3 py-1.5 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
            />
          </div>
          <div className="text-sm text-brand-100/50">
            {clients ? `${filtered.length} Client${filtered.length !== 1 ? 's' : ''}` : 'Loading...'}
          </div>
        </div>

        {/* Table — loading/empty states live OUTSIDE AnimatePresence
            so the stagger animation fires correctly when rows mount. */}
        {clients === undefined ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-brand-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 mb-4 text-brand-500 opacity-30" />
            <p className="text-brand-100/40 text-sm">
              {searchTerm ? 'No clients match your search.' : 'No clients yet. Add one to get started.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50 sticky top-0 border-b border-brand-800/30 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Name</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Company</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20">
                <AnimatePresence>
                  {filtered.map((client, index) => (
                    <motion.tr
                      key={client._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05, type: 'spring', bounce: 0, duration: 0.4 }}
                      onClick={() => navigate(`/clients/${client._id}`)}
                      className="hover:bg-brand-900/10 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-brand-400">
                              {client.name?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-brand-50 group-hover:text-brand-400 transition-colors">
                            {client.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-brand-100/70">
                        {client.company ? (
                          <span className="flex items-center">
                            <Building className="w-3.5 h-3.5 mr-1.5 text-brand-100/30" />
                            {client.company}
                          </span>
                        ) : (
                          <span className="text-brand-100/30 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          {client.email && (
                            <span className="flex items-center text-xs text-brand-100/60">
                              <Mail className="w-3 h-3 mr-1.5 text-brand-100/30" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="flex items-center text-xs text-brand-100/60">
                              <Phone className="w-3 h-3 mr-1.5 text-brand-100/30" />
                              {client.phone}
                            </span>
                          )}
                          {!client.email && !client.phone && (
                            <span className="text-brand-100/30 italic text-xs">No contact info</span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingClient={null}
      />
    </div>
  );
}
