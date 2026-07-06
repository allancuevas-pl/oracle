import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ASSET_TYPES = [
  'Industrial', 'Retail',
  'Office',     'Hybrid',
  'Mixed Use',  'Other',
];

const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

const DATE_OPTS = [
  { id: 'any',  label: 'Any time' },
  { id: '3mo',  label: 'Last 3 months' },
  { id: '6mo',  label: 'Last 6 months' },
  { id: '12mo', label: 'Last 12 months' },
];

export const NLA_MAX  = 10_000;
export const LAND_MAX = 20_000;

export function CompFilters({ isOpen, onClose, filters, onChange, onClear, activeCount }) {
  const set = (k, v) => onChange({ ...filters, [k]: v });

  const toggleAssetType = (type) => {
    const next = filters.assetTypes.includes(type)
      ? filters.assetTypes.filter(t => t !== type)
      : [...filters.assetTypes, type];
    set('assetTypes', next);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-[#0F0F0F] border border-white/[0.08] rounded-t-2xl sm:rounded-xl w-full sm:max-w-[520px] shadow-[0_24px_80px_rgba(0,0,0,0.7)] flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Filters</h2>
            {activeCount > 0 && (
              <span className="bg-brand-500/20 text-brand-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {activeCount} active
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-brand-100/40 hover:text-brand-100/80 hover:bg-white/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 divide-y divide-white/[0.04]">

          {/* Asset types */}
          <section className="px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">
                Asset type
              </span>
              {filters.assetTypes.length > 0 && (
                <button
                  onClick={() => set('assetTypes', [])}
                  className="text-[10px] text-brand-400/60 hover:text-brand-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-6">
              {ASSET_TYPES.map(type => {
                const active = filters.assetTypes.includes(type);
                return (
                  <label
                    key={type}
                    onClick={() => toggleAssetType(type)}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      active
                        ? 'bg-brand-500/20 border-brand-500/60'
                        : 'border-white/[0.14] bg-white/[0.02] group-hover:border-brand-500/30'
                    }`}>
                      {active && (
                        <svg className="w-2.5 h-2.5 text-brand-400" fill="none" viewBox="0 0 10 10">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className={`text-sm transition-colors ${
                      active ? 'text-brand-300' : 'text-brand-100/50 group-hover:text-brand-100/70'
                    }`}>
                      {type}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* State */}
          <section className="px-6 py-5 space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 block">
              State
            </span>
            <div className="grid grid-cols-4 gap-2">
              {AU_STATES.map(s => {
                const active = filters.state === s;
                return (
                  <button
                    key={s}
                    onClick={() => set('state', active ? '' : s)}
                    className={`py-2 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                        : 'bg-white/[0.02] border-white/[0.07] text-brand-100/45 hover:border-brand-500/20 hover:text-brand-100/70'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Date range */}
          <section className="px-6 py-5 space-y-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45 block">
              Date range
            </span>
            <div className="grid grid-cols-2 gap-2">
              {DATE_OPTS.map(d => (
                <button
                  key={d.id}
                  onClick={() => set('dateRange', d.id)}
                  className={`py-2.5 rounded-md text-xs font-medium border transition-colors ${
                    filters.dateRange === d.id
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                      : 'bg-white/[0.02] border-white/[0.07] text-brand-100/45 hover:border-brand-500/20 hover:text-brand-100/70'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          {/* Floor area (NLA) */}
          <RangeSection
            label="Floor area (NLA)"
            unit="sqm"
            min={0} max={NLA_MAX} step={50}
            low={filters.nlaMin} high={filters.nlaMax}
            onLow={v  => set('nlaMin', v)}
            onHigh={v => set('nlaMax', v)}
          />

          {/* Land area */}
          <RangeSection
            label="Land area"
            unit="sqm"
            min={0} max={LAND_MAX} step={100}
            low={filters.landMin} high={filters.landMax}
            onLow={v  => set('landMin', v)}
            onHigh={v => set('landMax', v)}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between shrink-0">
          <button
            onClick={onClear}
            className="text-sm text-brand-100/35 hover:text-brand-100/60 transition-colors"
          >
            Clear all filters
          </button>
          <button
            onClick={onClose}
            className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-5 py-2 rounded-md text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Range section ─────────────────────────────────────────────────────────────
function RangeSection({ label, unit, min, max, step, low, high, onLow, onHigh }) {
  const lowPct  = ((low  - min) / (max - min)) * 100;
  const highPct = ((high - min) / (max - min)) * 100;

  // Slug from the section label so each RangeSection instance has unique ids
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const minId = `${slug}-min`;
  const maxId = `${slug}-max`;

  const [localLow,  setLocalLow]  = useState('');
  const [localHigh, setLocalHigh] = useState('');

  const commitLow = () => {
    const v = parseInt(localLow, 10);
    if (!isNaN(v)) onLow(Math.max(min, Math.min(v, high - step)));
    setLocalLow('');
  };
  const commitHigh = () => {
    const v = parseInt(localHigh, 10);
    if (!isNaN(v)) onHigh(Math.min(max, Math.max(v, low + step)));
    setLocalHigh('');
  };

  const isDefault = low === min && high === max;

  return (
    <section className="px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-100/45">
          {label}
        </span>
        {!isDefault && (
          <span className="text-xs text-brand-400">
            {low.toLocaleString()} – {high >= max ? `${max.toLocaleString()}+` : high.toLocaleString()} {unit}
          </span>
        )}
      </div>

      {/* Slider */}
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/[0.07]" />
        <div
          className="absolute h-[3px] rounded-full bg-brand-500/60 pointer-events-none"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={low}
          onChange={e => { const v = Number(e.target.value); if (v < high) onLow(v); }}
          className={thumbInput + (low >= high - step * 2 ? ' z-[5]' : ' z-[3]')}
        />
        <input
          type="range" min={min} max={max} step={step} value={high}
          onChange={e => { const v = Number(e.target.value); if (v > low) onHigh(v); }}
          className={thumbInput + ' z-[4]'}
        />
      </div>

      {/* Text inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={minId} className="text-[10px] text-brand-100/40 uppercase tracking-widest">Min ({unit})</label>
          <input
            id={minId}
            type="number"
            placeholder={low === min ? 'Any' : low.toLocaleString()}
            value={localLow}
            onChange={e => setLocalLow(e.target.value)}
            onBlur={commitLow}
            onKeyDown={e => e.key === 'Enter' && commitLow()}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-md px-3 py-2.5 text-sm text-brand-100/60 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/30 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={maxId} className="text-[10px] text-brand-100/40 uppercase tracking-widest">Max ({unit})</label>
          <input
            id={maxId}
            type="number"
            placeholder={high === max ? 'Any' : high.toLocaleString()}
            value={localHigh}
            onChange={e => setLocalHigh(e.target.value)}
            onBlur={commitHigh}
            onKeyDown={e => e.key === 'Enter' && commitHigh()}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-md px-3 py-2.5 text-sm text-brand-100/60 placeholder:text-brand-100/40 focus:outline-none focus:border-brand-500/30 transition-colors"
          />
        </div>
      </div>
    </section>
  );
}

const thumbInput = [
  'absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:h-[18px]',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500',
  '[&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[#0F0F0F]',
  '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab',
  '[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none',
  '[&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:h-[18px]',
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-500',
  '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[#0F0F0F]',
  '[&::-moz-range-thumb]:cursor-grab',
].join(' ');
