import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MapPin, Users, KeyRound, Loader2 } from 'lucide-react';
import { TeamSection } from '../components/settings/TeamSection';
import { ApiKeyCard } from '../components/settings/ApiKeyCard';

export function Settings() {
  const currentUser = useQuery(api.users.getCurrentUser);

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
            <Users className="w-4 h-4 text-brand-100/30" />
            <h2 className="text-sm font-semibold text-brand-50">Team</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            Manage team members and send invitations. Admins can change roles and remove access.
          </p>
        </div>

        {currentUser === undefined ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
          </div>
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
            <KeyRound className="w-4 h-4 text-brand-100/30" />
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

    </div>
  );
}
