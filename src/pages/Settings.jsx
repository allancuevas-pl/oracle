import React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MapPin, Users, KeyRound, ScanSearch, Check } from 'lucide-react';
import { TeamSection } from '../components/settings/TeamSection';
import { ApiKeyCard } from '../components/settings/ApiKeyCard';
import { Spinner } from '../components/ui/Loading';
import { toast } from 'sonner';

const ORACLE_MODELS = [
  { id: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5',  note: 'Fastest · lowest cost' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5',  note: 'Balanced · recommended' },
  { id: 'claude-opus-4-5',   label: 'Claude Opus 4.5',    note: 'Most capable · slowest' },
];

export function Settings() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const oracleModel = useQuery(api.settings.getOracleModel);
  const setOracleModel = useMutation(api.settings.setOracleModel);
  const isAdmin = currentUser?.role === 'admin';

  const handleModelSelect = async (modelId) => {
    if (!isAdmin) return;
    try {
      await setOracleModel({ model: modelId });
      toast.success('Oracle model updated');
    } catch {
      toast.error('Failed to update model');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-8 py-10">

      {/* Page header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">
          Configuration
        </p>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-brand-100/40 mt-1">
          Manage workspace configuration and third-party integrations.
        </p>
      </div>

      {/* Team section */}
      <section className="space-y-4 mb-10">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand-100/45" />
            <h2 className="text-sm font-semibold text-brand-50">Team</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            Manage team members and send invitations. Admins can change roles and remove access.
          </p>
        </div>

        {currentUser === undefined ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <TeamSection currentUser={currentUser} />
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-10" />

      {/* Integrations section */}
      <section className="space-y-4">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-brand-100/45" />
            <h2 className="text-sm font-semibold text-brand-50">Integrations</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            API keys for external services. Stored locally in this browser — not synced across devices.
          </p>
        </div>

        <ApiKeyCard
          title="Google Maps API"
          icon={MapPin}
          description="Enables address autocomplete when adding or editing properties. Requires a Google Maps Platform API key with the Places API enabled and an authorised domain."
          docsUrl="https://developers.google.com/maps/documentation/places/web-service/get-api-key"
          placeholder="AIzaSy…"
        />
      </section>

      {/* Divider */}
      <div className="border-t border-white/[0.06] mb-10 mt-10" />

      {/* Oracle section */}
      <section className="space-y-4">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <ScanSearch className="w-4 h-4 text-brand-100/45" />
            <h2 className="text-sm font-semibold text-brand-50">Oracle Scanner</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            Choose the Claude model used for IM extraction. Applies to all scans workspace-wide.
            {!isAdmin && <span className="text-brand-500/70"> Admin only.</span>}
          </p>
        </div>

        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
          {ORACLE_MODELS.map((m, i) => {
            const active = (oracleModel ?? 'claude-sonnet-4-5') === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleModelSelect(m.id)}
                disabled={!isAdmin}
                className={`w-full flex items-center justify-between px-5 py-4 transition-colors text-left
                  ${i > 0 ? 'border-t border-white/[0.04]' : ''}
                  ${active ? 'bg-brand-500/[0.06]' : 'hover:bg-white/[0.02]'}
                  ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                `}
              >
                <div>
                  <p className={`text-sm font-medium ${active ? 'text-brand-400' : 'text-brand-100/70'}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-brand-100/45 mt-0.5">{m.note}</p>
                </div>
                {active && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

    </div>
  );
}
