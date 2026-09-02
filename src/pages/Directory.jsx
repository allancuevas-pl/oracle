import React, { useState, useMemo } from 'react';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { Plus, Contact, Search, Mail, Phone, Building, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkeletonTable } from '../components/ui/Loading';
import { rowEntrance } from '../components/ui/motion';
import { ContactModal } from '../components/directory/ContactModal';

const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

const TABS = [
  { key: 'all',        label: 'All' },
  { key: 'client',     label: 'Clients' },
  { key: 'agent',      label: 'Agents' },
  { key: 'contractor', label: 'Contractors' },
  { key: 'solicitor',  label: 'Solicitors' },
  { key: 'broker',     label: 'Brokers' },
  { key: 'other',      label: 'Other' },
];

const CATEGORY_META = {
  client:     { label: 'Client',     cls: 'text-emerald-400 bg-emerald-900/15 border-emerald-800/30' },
  agent:      { label: 'Agent',      cls: 'text-brand-400 bg-brand-900/20 border-brand-800/30' },
  contractor: { label: 'Contractor', cls: 'text-sky-400 bg-sky-900/15 border-sky-800/30' },
  solicitor:  { label: 'Solicitor',  cls: 'text-violet-400 bg-violet-900/15 border-violet-800/30' },
  broker:     { label: 'Broker',     cls: 'text-amber-400 bg-amber-900/15 border-amber-800/30' },
  other:      { label: 'Other',      cls: 'text-brand-100/50 bg-white/[0.03] border-white/[0.06]' },
};

const NotSpecified = () => <span className="text-brand-100/30 italic">Not specified</span>;

export function Directory() {
  const navigate = useNavigate();
  const clients = useQuery(api.clients.getClients);
  const contacts = useQuery(api.contacts.listContacts, {});

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const loading = clients === undefined || contacts === undefined;

  // Merge clients + contacts into one directory shape.
  const entries = useMemo(() => {
    const c = (clients ?? []).map((x) => ({
      id: x._id, kind: 'client', clientId: x._id, category: 'client',
      name: x.name, company: x.company, email: x.email, phone: x.phone,
      state: undefined, suburb: undefined, specialty: undefined,
    }));
    const k = (contacts ?? []).map((x) => ({
      id: x._id, kind: 'contact', raw: x, category: x.category,
      name: x.name, company: x.company, email: x.email, phone: x.phone,
      state: x.state, suburb: x.suburb, specialty: x.specialty,
    }));
    return [...c, ...k].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [clients, contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (tab !== 'all' && e.category !== tab) return false;
      if (stateFilter && e.state !== stateFilter) return false;
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.company?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.specialty?.toLowerCase().includes(q)
      );
    });
  }, [entries, tab, search, stateFilter]);

  const openRow = (e) => {
    if (e.kind === 'client') navigate(`/clients/${e.clientId}`);
    else { setEditing(e.raw); setModalOpen(true); }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center">
            <Contact className="w-6 h-6 mr-3 text-brand-500" />
            Directory
          </h1>
          <p className="text-sm text-brand-100/50 mt-1">Clients, agents, contractors, solicitors and brokers in one place.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-2.5 rounded-md text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.15)] flex items-center justify-center shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Contact
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t) => {
          const count = t.key === 'all'
            ? entries.length
            : entries.filter((e) => e.category === t.key).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30' : 'text-brand-100/50 hover:text-brand-100 border border-transparent'}`}
            >
              {t.label}
              {!loading && <span className="ml-1.5 text-xs text-brand-100/40">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="flex-1 bg-[#0A0A0A] border border-brand-800/30 rounded-xl overflow-hidden flex flex-col shadow-xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-brand-800/30 bg-[#111] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/45" />
              <input
                type="text"
                placeholder="Search name, company, specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-brand-800/50 rounded-md pl-9 pr-3 py-1.5 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors"
              />
            </div>
            <CustomSelect
              variant="compact"
              ariaLabel="Filter by state"
              value={stateFilter}
              onChange={setStateFilter}
              placeholder="All states"
              options={[{ value: '', label: 'All states' }, ...AU_STATES.map((s) => ({ value: s, label: s }))]}
              className="w-36"
            />
          </div>
          <div className="text-sm text-brand-100/50 shrink-0">
            {loading ? 'Loading...' : `${filtered.length} contact${filtered.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
            <Contact className="w-10 h-10 mb-4 text-brand-500 opacity-30" />
            <p className="text-brand-100/40 text-sm">
              {search || stateFilter || tab !== 'all' ? 'No contacts match your filters.' : 'No contacts yet. Add one to get started.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-brand-100/50 uppercase bg-[#0A0A0A]/50 sticky top-0 border-b border-brand-800/30 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold tracking-wider">Name</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Category</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Company / Role</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Contact</th>
                  <th className="px-6 py-4 font-semibold tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-800/20">
                <AnimatePresence>
                  {filtered.map((e, index) => {
                    const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
                    return (
                      <motion.tr
                        key={`${e.kind}-${e.id}`}
                        {...rowEntrance(Math.min(index, 20))}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => openRow(e)}
                        className="hover:bg-brand-900/10 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-brand-400">{e.name?.charAt(0)?.toUpperCase()}</span>
                            </div>
                            <span className="font-medium text-brand-50 group-hover:text-brand-400 transition-colors">{e.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
                        </td>
                        <td className="px-6 py-4 text-brand-100/70">
                          {e.company || e.specialty ? (
                            <div className="flex flex-col">
                              {e.company && <span className="flex items-center"><Building className="w-3.5 h-3.5 mr-1.5 text-brand-100/45" />{e.company}</span>}
                              {e.specialty && <span className="text-xs text-brand-100/45 mt-0.5">{e.specialty}</span>}
                            </div>
                          ) : <NotSpecified />}
                        </td>
                        <td className="px-6 py-4">
                          {e.email || e.phone ? (
                            <div className="flex flex-col space-y-1">
                              {e.email && <span className="flex items-center text-xs text-brand-100/60"><Mail className="w-3 h-3 mr-1.5 text-brand-100/45" />{e.email}</span>}
                              {e.phone && <span className="flex items-center text-xs text-brand-100/60"><Phone className="w-3 h-3 mr-1.5 text-brand-100/45" />{e.phone}</span>}
                            </div>
                          ) : <NotSpecified />}
                        </td>
                        <td className="px-6 py-4 text-brand-100/70">
                          {e.state || e.suburb ? (
                            <span className="flex items-center text-xs"><MapPin className="w-3 h-3 mr-1.5 text-brand-100/45" />{[e.suburb, e.state].filter(Boolean).join(', ')}</span>
                          ) : <NotSpecified />}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContactModal isOpen={modalOpen} onClose={() => setModalOpen(false)} editingContact={editing} />
    </div>
  );
}
