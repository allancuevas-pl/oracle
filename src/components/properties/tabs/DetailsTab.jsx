import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../convex/_generated/api';
import { CustomSelect } from '../../ui/CustomSelect';
import { PropertyPhotos } from '../PropertyPhotos';
import { Loader2, FileText, Building2, Pencil } from 'lucide-react';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtMoney = (val) => {
  if (val == null) return null;
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (val >= 1_000)     return '$' + Math.round(val / 1_000) + 'K';
  return '$' + val.toLocaleString();
};

function DataRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-brand-100/50">{label}</span>
      <span className="text-sm text-brand-50 font-medium text-right ml-4 max-w-[60%]">
        {value || <span className="text-brand-100/40 italic font-normal">—</span>}
      </span>
    </div>
  );
}

// ── Inline-editable tile ──────────────────────────────────────────────────────
// editable=true  → click to enter a raw number; blur/Enter saves
// editable=false → read-only derived value
// tooltip        → shown below value for non-editable fields
function MetricTile({ label, value, highlight, sub, editable, tooltip, onSave }) {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef                = useRef(null);

  const isEmpty = !value;

  const startEdit = () => {
    if (!editable) return;
    // Strip formatting — keep only digits and decimal point
    setInputVal(value ? value.replace(/[^0-9.]/g, '') : '');
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n) && n !== parseFloat((value || '').replace(/[^0-9.]/g, ''))) {
      onSave(n);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  return (
    <div
      className={`px-4 py-3 bg-[#0A0A0A] relative group ${editable ? 'cursor-pointer' : ''}`}
      onClick={!editing ? startEdit : undefined}
      title={!editable && tooltip ? tooltip : undefined}
    >
      <p className="text-[10px] uppercase tracking-widest text-brand-100/45 mb-1 flex items-center gap-1">
        {label}
        {editable && !editing && (
          <Pencil className="w-2.5 h-2.5 text-brand-100/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </p>

      {editing ? (
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="w-full bg-transparent border-b border-brand-500/60 text-sm text-brand-100 focus:outline-none py-0.5 tabular-nums"
          placeholder="0"
        />
      ) : (
        <>
          <p className={`text-sm font-semibold tabular-nums leading-tight ${
            isEmpty     ? (editable ? 'text-brand-100/40 italic font-normal text-xs' : 'text-brand-100/40 font-normal') :
            highlight   ? 'text-amber-400' :
                          'text-brand-300'
          }`}>
            {value || (editable ? 'Click to add' : '—')}
          </p>
          {sub && <p className="text-[10px] text-brand-100/40 mt-0.5">{sub}</p>}
          {!editable && tooltip && isEmpty && (
            <p className="text-[10px] text-brand-100/40 mt-0.5 leading-tight">{tooltip}</p>
          )}
        </>
      )}
    </div>
  );
}

// ── Property summary card — feaso-style, always-visible 5×2 grid ─────────────
// Row 1: NLA | Land | Rent pa | Rent/m² | Asking price
// Row 2: Cap rate | $/m² (build) | $/m² (land) | WALE | Occupancy
function PropertySummaryCard({ metrics, onSave }) {
  const COLS = [
    'NLA', 'Land', 'Rent pa', 'Rent/m²', 'Asking price',
    'Cap rate', '$/m² (build)', '$/m² (land)', 'WALE', 'Occupancy',
  ];
  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden mb-6">
      <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">Subject Property</p>
      </div>
      <div className="grid grid-cols-5 divide-x divide-y divide-white/[0.04]">
        {COLS.map((col) => {
          const m = metrics[col] || {};
          return (
            <MetricTile
              key={col}
              label={col}
              value={m.value}
              highlight={m.highlight}
              sub={m.sub}
              editable={m.editable}
              tooltip={m.tooltip}
              onSave={(n) => onSave(m.field, n)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DetailsTab({ property, updateProperty }) {
  const navigate = useNavigate();
  const matches = useQuery(api.matches.getMatchesForProperty, { propertyId: property._id });

  // Derived from tenants
  const tenants        = property.tenants || [];
  const netPassingRent = tenants.reduce((s, t) => s + (t.netFaceRent || 0), 0);
  const occupiedArea   = tenants.reduce((s, t) => s + (t.lettableArea || 0), 0);
  const occupancyPct   = property.buildingArea
    ? Math.min(100, Math.round((occupiedArea / property.buildingArea) * 100))
    : null;

  // WALE: 0 is meaningful (expired) — never hide it
  const waleDisplay = property.wales != null
    ? property.wales === 0
      ? '0.0 yrs (expired)'
      : `${property.wales.toFixed(1)} yrs`
    : null;

  // ── Derived upside metrics — feaso column order ────────────────────────────
  const ap  = property.askingPrice;
  const nla = property.buildingArea;
  const la  = property.landArea;

  const pricePerSqmBuild = ap && nla ? Math.round(ap / nla) : null;
  const pricePerSqmLand  = ap && la  ? Math.round(ap / la)  : null;
  const rentPerSqm       = netPassingRent > 0 && nla ? Math.round(netPassingRent / nla) : null;

  // Cap rate: prefer stated yield, fall back to implied from passing rent / asking price
  const impliedCapRateRaw = netPassingRent > 0 && ap && ap > 0
    ? (netPassingRent / ap) * 100
    : null;
  const capRateValue = property.estimatedYield ?? impliedCapRateRaw;
  const capRateSub   = property.estimatedYield
    ? impliedCapRateRaw ? `implied ${impliedCapRateRaw.toFixed(2)}%` : null
    : impliedCapRateRaw ? 'implied' : null;

  // Build the metrics map keyed by column label
  // editable=true  → click to edit inline, saves direct field via updateProperty
  // editable=false → derived/read-only, tooltip explains where to edit
  const metrics = {
    'NLA':          { value: nla ? `${nla.toLocaleString()} m²` : null,             editable: true,  field: 'buildingArea' },
    'Land':         { value: la  ? `${la.toLocaleString()} m²`  : null,             editable: true,  field: 'landArea' },
    'Rent pa':      { value: netPassingRent > 0 ? fmtMoney(netPassingRent) : null,  editable: false, tooltip: 'Edit in Tenancy Schedule' },
    'Rent/m²':      { value: rentPerSqm ? `$${rentPerSqm}/m²` : null,              editable: false, tooltip: 'Calculated — Rent ÷ NLA' },
    'Asking price': { value: ap ? fmtMoney(ap) : null,                              editable: true,  field: 'askingPrice' },
    'Cap rate':     {
      value: capRateValue != null ? `${capRateValue.toFixed(2)}%` : null,
      sub:   capRateSub,
      editable: true,
      field: 'estimatedYield',
      tooltip: property.estimatedYield ? null : 'Click to add stated yield',
    },
    '$/m² (build)': { value: pricePerSqmBuild ? `$${pricePerSqmBuild.toLocaleString()}` : null, editable: false, tooltip: 'Calculated — Asking ÷ NLA' },
    '$/m² (land)':  { value: pricePerSqmLand  ? `$${pricePerSqmLand.toLocaleString()}`  : null, editable: false, tooltip: 'Calculated — Asking ÷ Land' },
    'WALE': {
      value: waleDisplay,
      highlight: property.wales != null && property.wales < 1,
      editable: true,
      field: 'wales',
    },
    'Occupancy': { value: occupancyPct !== null ? `${occupancyPct}%` : null, editable: false, tooltip: 'Calculated — from Tenancy Schedule' },
  };

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Feaso-style subject property summary — always-visible, all 10 columns ── */}
      <PropertySummaryCard
        metrics={metrics}
        onSave={(field, value) => updateProperty({ id: property._id, [field]: value })}
      />

      {/* ── Photos (from IM scan) ── */}
      <PropertyPhotos photoIds={property.photoIds} propertyId={property._id} />

      {/* ── Listing status ── */}
      <section className="space-y-3 pb-5 border-b border-white/[0.04]">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">Listing Status</h2>
        <CustomSelect
          value={property.status}
          onChange={(value) => updateProperty({ id: property._id, status: value })}
          options={['On Market', 'Off Market', 'Under Offer', 'Sold', 'Archived']}
          variant="status-pill"
        />
      </section>

      {/* ── Property details + Financials ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-3">Property Details</h2>
          <div>
            <DataRow label="Asset Type"    value={property.assetType} />
            <DataRow label="Location"      value={property.location} />
            <DataRow label="Suburb"        value={property.suburb} />
            <DataRow label="Land Area"     value={property.landArea ? `${property.landArea.toLocaleString()} sqm` : null} />
            <DataRow label="Building Area" value={property.buildingArea ? `${property.buildingArea.toLocaleString()} sqm` : null} />
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-3">Financial Overview</h2>
          <div>
            <DataRow label="Asking Price"     value={fmtMoney(property.askingPrice)} />
            <DataRow label="Net Passing Rent" value={netPassingRent > 0 ? `${fmtMoney(netPassingRent)}/pa` : null} />
            <DataRow label="Stated Yield"     value={property.estimatedYield ? `${property.estimatedYield}%` : null} />
            <DataRow label="WALE"             value={waleDisplay} />
            <DataRow label="Occupancy"        value={occupancyPct !== null ? `${occupancyPct}%` : null} />
            <DataRow label="Tenants"          value={tenants.length > 0 ? `${tenants.length}` : null} />
          </div>
        </section>
      </div>

      {/* ── Description ── */}
      {property.description && (
        <section className="pt-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">Description</h2>
          <p className="text-sm text-brand-100/60 leading-relaxed whitespace-pre-wrap">
            {property.description}
          </p>
        </section>
      )}

      {/* ── Active deals ── */}
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
            <Building2 className="w-6 h-6 text-brand-100/40 mx-auto mb-2" />
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
  );
}
