import React from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../convex/_generated/api';
import { CustomSelect } from '../../ui/CustomSelect';
import { PulseFeed } from '../../ui/PulseFeed';
import { Loader2, FileText, Building2, Users } from 'lucide-react';

const fmt = (val) => {
  if (!val) return null;
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (val >= 1_000) return '$' + (val / 1_000).toFixed(0) + 'K';
  return '$' + val.toLocaleString();
};

function DataRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-brand-100/50">{label}</span>
      <span className="text-sm text-brand-50 font-medium text-right ml-4 max-w-[60%]">
        {value || <span className="text-brand-100/25 italic font-normal">—</span>}
      </span>
    </div>
  );
}

export function DetailsTab({ property, updateProperty }) {
  const navigate = useNavigate();
  const matches = useQuery(api.matches.getMatchesForProperty, { propertyId: property._id });

  // Derived from tenants
  const tenants = property.tenants || [];
  const netPassingRent = tenants.reduce((sum, t) => sum + (t.netFaceRent || 0), 0);
  const occupiedArea = tenants.reduce((sum, t) => sum + (t.lettableArea || 0), 0);
  const occupancyPct = property.buildingArea
    ? Math.min(100, Math.round((occupiedArea / property.buildingArea) * 100))
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

      {/* Left/Centre column — property data */}
      <div className="lg:col-span-2 space-y-6">

        {/* Listing Status */}
        <section className="space-y-3 pb-5 border-b border-white/[0.04]">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">Listing Status</h2>
          <CustomSelect
            value={property.status}
            onChange={(value) => updateProperty({ id: property._id, status: value })}
            options={['On Market', 'Off Market', 'Under Offer', 'Sold', 'Archived']}
            variant="status-pill"
          />
        </section>

        {/* Property Details + Financials in a two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Property Details */}
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-3">Property Details</h2>
            <div>
              <DataRow label="Asset Type" value={property.assetType} />
              <DataRow label="Location" value={property.location} />
              <DataRow
                label="Land Area"
                value={property.landArea ? `${property.landArea.toLocaleString()} sqm` : null}
              />
              <DataRow
                label="Building Area"
                value={property.buildingArea ? `${property.buildingArea.toLocaleString()} sqm` : null}
              />
            </div>
          </section>

          {/* Financial Overview */}
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-3">Financial Overview</h2>
            <div>
              <DataRow label="Asking Price" value={fmt(property.askingPrice)} />
              <DataRow
                label="Est. Yield"
                value={property.estimatedYield ? `${property.estimatedYield}%` : null}
              />
              <DataRow
                label="WALE"
                value={property.wales ? `${property.wales} yrs` : null}
              />
              <DataRow
                label="Net Passing Rent"
                value={netPassingRent > 0 ? `${fmt(netPassingRent)}/pa` : null}
              />
              <DataRow
                label="Occupancy"
                value={occupancyPct !== null ? `${occupancyPct}%` : null}
              />
            </div>
          </section>
        </div>

        {/* Description */}
        {property.description && (
          <section className="pt-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">Description</h2>
            <p className="text-sm text-brand-100/60 leading-relaxed whitespace-pre-wrap">
              {property.description}
            </p>
          </section>
        )}

        {/* Active Deals */}
        <section className="pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">Active Deals</h2>
            {matches && matches.length > 0 && (
              <span className="text-[10px] font-bold text-brand-400 bg-brand-900/30 border border-brand-800/50 px-2 py-0.5 rounded-full">
                {matches.length} BRIEF{matches.length !== 1 ? 'S' : ''}
              </span>
            )}
          </div>

          {matches === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-6 text-center">
              <Building2 className="w-6 h-6 text-brand-100/20 mx-auto mb-2" />
              <p className="text-xs text-brand-100/40">
                Not matched to any briefs yet. Match this property from an active brief.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((match) => (
                <div
                  key={match._id}
                  onClick={() => navigate(`/briefs/${match.briefId}`)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.04] hover:border-brand-500/20 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded bg-brand-900/40 border border-brand-800/50 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-brand-500/60" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-brand-50 group-hover:text-brand-400 transition-colors font-medium truncate">
                        {match.brief?.clientName || 'Unknown Client'}
                      </p>
                      {match.brief?.briefId && (
                        <p className="text-[10px] text-brand-100/40 font-mono">{match.brief.briefId}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-brand-100/50 bg-brand-900/30 px-2 py-0.5 rounded shrink-0 ml-3">
                    {match.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Right column — Activity Feed */}
      <div className="lg:col-span-1">
        <PulseFeed recordId={property._id} recordType="property" />
      </div>
    </div>
  );
}
