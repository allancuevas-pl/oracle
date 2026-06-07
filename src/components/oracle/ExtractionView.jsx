import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Copy, RotateCcw, Clock, Cpu } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = {
  money: (n) => (n == null || n === '') ? '' : '$' + Math.round(Number(n)).toLocaleString('en-AU'),
  pct: (n) => (n == null || n === '') ? '' : Number(n).toFixed(2) + '%',
  sqm: (n) => (n == null || n === '') ? '' : Number(n).toLocaleString('en-AU') + ' m²',
};

const numberOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? null : n;
};

const setIn = (obj, path, value) => {
  const next = structuredClone(obj);
  const keys = path.split('.');
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return next;
};

function buildSheetRow(e) {
  const sp = e.subject_property || {};
  const fin = e.financial || {};
  const sale = e.sale_process || {};
  const ten = e.tenancies || [];
  const comps = e.comps_in_im || {};
  const headers = [
    'Address', 'Suburb', 'State', 'Postcode',
    'NLA m²', 'Building m²', 'Land m²', 'Asset class', 'Zoning', 'Title', 'Car spaces', 'Year built',
    'Asking price', 'Asking text', 'Passing rent pa', 'Rent basis',
    'Cap rate stated %', 'Cap rate calc %', 'Outgoings total', 'Non-recoverable',
    'GST', 'Sale method', 'Auction/EOI', 'Vendor', 'Agent firm', 'Agent',
    '# tenancies', 'Tenants', '# sales comps', '# leasing comps',
    'Other info',
  ];
  const row = [
    sp.address?.full, sp.address?.suburb, sp.address?.state, sp.address?.postcode,
    sp.nla_sqm, sp.building_area_sqm, sp.land_size_sqm, sp.asset_class, sp.zoning,
    sp.title_type, sp.car_spaces, sp.year_built,
    fin.asking_price, fin.asking_price_text, fin.passing_rent_total_pa, fin.rent_basis,
    fin.cap_rate_stated_pct, fin.cap_rate_calculated_pct, fin.outgoings_total_pa, fin.non_recoverable_total_pa,
    fin.gst_treatment, sale.sale_method, sale.auction_details, sale.vendor, sale.agent_firm, sale.agent_name,
    ten.length, ten.map((t) => t.tenant_name || t.permitted_use || '?').join(' | '),
    (comps.sales || []).length, (comps.leasing || []).length,
    e.other_useful_info,
  ];
  return [
    headers.join('\t'),
    row.map((v) => (v == null ? '' : String(v).replace(/[\t\n\r]/g, ' '))).join('\t'),
  ].join('\n');
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function ConfBadge({ level }) {
  if (!level || level === 'n/a') return null;
  const cls = {
    high: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    low: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  }[level] || '';
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-medium ${cls}`}>
      {level}
    </span>
  );
}

function Field({ label, value, conf, onChange, type = 'text', suffix, multiline }) {
  const display = (value == null || value === '') ? '' : String(value);
  const Tag = multiline ? 'textarea' : 'input';

  const handleChange = (e) => {
    const v = e.target.value;
    if (type === 'number') onChange(numberOrNull(v));
    else onChange(v === '' ? null : v);
  };

  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <span className="text-[10px] uppercase tracking-wider text-brand-100/35 font-medium">{label}</span>
        {conf && <ConfBadge level={conf} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <Tag
          rows={multiline ? 3 : undefined}
          className="block w-full bg-transparent border-b border-white/[0.08] py-1 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none placeholder:text-brand-100/20 resize-none transition-colors"
          value={display}
          placeholder="—"
          onChange={handleChange}
        />
        {suffix && <span className="text-brand-100/30 text-xs shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] overflow-hidden mb-4">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">{title}</p>
        {badge && <span className="text-[10px] text-brand-100/30">{badge}</span>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Tenancy table ────────────────────────────────────────────────────────────

const TENANCY_COLS = [
  { key: 'unit_label', label: 'Unit', w: 'w-20' },
  { key: 'tenant_name', label: 'Tenant', w: 'w-44' },
  { key: 'size_sqm', label: 'Size m²', w: 'w-20', type: 'number', align: 'right' },
  { key: 'lease_start', label: 'Lease start', w: 'w-28' },
  { key: 'lease_expiry', label: 'Lease expiry', w: 'w-28' },
  { key: 'options', label: 'Options', w: 'w-24' },
  { key: 'review_mechanism', label: 'Review', w: 'w-32' },
  { key: 'current_rent_pa', label: 'Rent pa', w: 'w-28', type: 'number', align: 'right' },
  { key: 'rent_basis', label: 'Basis', w: 'w-16' },
  { key: 'permitted_use', label: 'Use', w: 'w-36' },
];

function TenancyTable({ tenancies, onChange }) {
  const update = (i, key, value) => {
    const next = [...tenancies];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const addRow = () => onChange([...tenancies, {
    unit_label: null, tenant_name: null, size_sqm: null,
    lease_start: null, lease_expiry: null, options: null,
    review_mechanism: null, current_rent_pa: null, rent_basis: 'net', permitted_use: null,
  }]);
  const removeRow = (i) => onChange(tenancies.filter((_, j) => j !== i));

  if (!tenancies || tenancies.length === 0) {
    return (
      <div>
        <p className="text-xs text-brand-100/30 italic mb-2">No tenancies extracted.</p>
        <button onClick={addRow} className="text-xs text-brand-500 hover:text-brand-400 transition-colors">+ Add row</button>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {TENANCY_COLS.map((c) => (
                <th key={c.key} className={`text-left py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/30 font-medium ${c.w} ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {tenancies.map((t, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                {TENANCY_COLS.map((c) => (
                  <td key={c.key} className={`py-1 px-1 ${c.align === 'right' ? 'text-right' : ''}`}>
                    <input
                      className={`w-full bg-transparent py-1 px-1.5 rounded text-brand-50 focus:bg-white/[0.04] focus:outline-none transition-colors ${c.align === 'right' ? 'text-right' : ''}`}
                      value={t[c.key] ?? ''}
                      onChange={(e) => update(i, c.key, c.type === 'number' ? numberOrNull(e.target.value) : (e.target.value || null))}
                    />
                  </td>
                ))}
                <td>
                  <button onClick={() => removeRow(i)} className="p-1 text-brand-100/20 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="text-xs text-brand-500 hover:text-brand-400 transition-colors mt-3 flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add row
      </button>
    </div>
  );
}

// ─── Outgoings table ──────────────────────────────────────────────────────────

function OutgoingsTable({ items, onChange }) {
  const update = (i, key, value) => {
    const next = [...(items || [])];
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  };
  const add = () => onChange([...(items || []), { item: '', amount_pa: null, recoverable: true }]);
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const total = (items || []).reduce((s, og) => s + (og.amount_pa || 0), 0);

  if (!items || items.length === 0) {
    return (
      <div>
        <p className="text-xs text-brand-100/30 italic mb-2">No outgoings line items extracted.</p>
        <button onClick={add} className="text-xs text-brand-500 hover:text-brand-400 transition-colors">+ Add item</button>
      </div>
    );
  }

  return (
    <div>
      <table className="text-xs w-full mb-3">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/30 font-medium">Item</th>
            <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/30 font-medium w-28">Amount pa</th>
            <th className="text-center py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/30 font-medium w-28">Recoverable</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((og, i) => (
            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-1 px-1">
                <input className="w-full bg-transparent py-1 px-1.5 rounded text-brand-50 focus:bg-white/[0.04] focus:outline-none transition-colors"
                  value={og.item ?? ''} onChange={(e) => update(i, 'item', e.target.value)} />
              </td>
              <td className="py-1 px-1 text-right">
                <input className="w-full bg-transparent py-1 px-1.5 rounded text-brand-50 text-right focus:bg-white/[0.04] focus:outline-none transition-colors"
                  value={og.amount_pa ?? ''} onChange={(e) => update(i, 'amount_pa', numberOrNull(e.target.value))} />
              </td>
              <td className="py-1 px-2 text-center">
                <button
                  onClick={() => update(i, 'recoverable', !og.recoverable)}
                  className={`text-[9px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                    og.recoverable === true ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
                    og.recoverable === false ? 'border-orange-500/30 bg-orange-500/10 text-orange-400' :
                    'border-white/[0.08] text-brand-100/30'
                  }`}
                >
                  {og.recoverable === true ? 'Recoverable' : og.recoverable === false ? 'Non-recov' : '—'}
                </button>
              </td>
              <td>
                <button onClick={() => remove(i)} className="p-1 text-brand-100/20 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/40">Total</td>
            <td className="py-2 px-2 text-right text-sm text-brand-50 font-medium">{fmt.money(total)}</td>
            <td colSpan="2" />
          </tr>
        </tbody>
      </table>
      <button onClick={add} className="text-xs text-brand-500 hover:text-brand-400 transition-colors flex items-center gap-1">
        <Plus className="w-3 h-3" /> Add item
      </button>
    </div>
  );
}

// ─── Sales comps table ────────────────────────────────────────────────────────

const SALES_COLS = [
  { key: 'address', label: 'Address', w: 'min-w-[12rem]' },
  { key: 'asset_class', label: 'Class', w: 'w-24' },
  { key: 'nla_sqm', label: 'NLA m²', w: 'w-20', type: 'number', align: 'right' },
  { key: 'sale_price', label: 'Sale $', w: 'w-28', type: 'number', align: 'right' },
  { key: 'price_per_sqm_build', label: '$/m²', w: 'w-20', type: 'number', align: 'right' },
  { key: 'yield_pct', label: 'Yield %', w: 'w-20', type: 'number', align: 'right' },
  { key: 'sale_date', label: 'Date', w: 'w-24' },
  { key: 'notes', label: 'Notes', w: 'min-w-[10rem]' },
];

function SalesCompsTable({ comps, onChange }) {
  const update = (i, key, value) => { const n = [...comps]; n[i] = { ...n[i], [key]: value }; onChange(n); };
  const add = () => onChange([...(comps || []), { address: '', suburb: null, asset_class: null, nla_sqm: null, sale_price: null, price_per_sqm_build: null, yield_pct: null, sale_date: null, notes: null }]);
  const remove = (i) => onChange(comps.filter((_, j) => j !== i));

  if (!comps || comps.length === 0) {
    return (
      <div>
        <p className="text-xs text-brand-100/30 italic mb-2">No sales comps in this IM.</p>
        <button onClick={add} className="text-xs text-brand-500 hover:text-brand-400 transition-colors">+ Add comp</button>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {SALES_COLS.map((c) => (
                <th key={c.key} className={`text-left py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/30 font-medium ${c.w} ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                {SALES_COLS.map((col) => (
                  <td key={col.key} className={`py-1 px-1 ${col.align === 'right' ? 'text-right' : ''}`}>
                    <input
                      className={`w-full bg-transparent py-1 px-1.5 rounded text-brand-50 focus:bg-white/[0.04] focus:outline-none transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                      value={c[col.key] ?? ''}
                      onChange={(e) => update(i, col.key, col.type === 'number' ? numberOrNull(e.target.value) : (e.target.value || null))}
                    />
                  </td>
                ))}
                <td><button onClick={() => remove(i)} className="p-1 text-brand-100/20 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className="text-xs text-brand-500 hover:text-brand-400 transition-colors mt-3 flex items-center gap-1"><Plus className="w-3 h-3" /> Add comp</button>
    </div>
  );
}

// ─── Leasing comps table ──────────────────────────────────────────────────────

const LEASE_COLS = [
  { key: 'address', label: 'Address', w: 'min-w-[12rem]' },
  { key: 'asset_class', label: 'Class', w: 'w-24' },
  { key: 'nla_sqm', label: 'NLA m²', w: 'w-20', type: 'number', align: 'right' },
  { key: 'rent_pa', label: 'Rent pa', w: 'w-28', type: 'number', align: 'right' },
  { key: 'rent_per_sqm', label: '$/m²', w: 'w-20', type: 'number', align: 'right' },
  { key: 'lease_date', label: 'Date', w: 'w-24' },
  { key: 'term_years', label: 'Term yrs', w: 'w-16', type: 'number', align: 'right' },
  { key: 'notes', label: 'Notes', w: 'min-w-[10rem]' },
];

function LeasingCompsTable({ comps, onChange }) {
  const update = (i, key, value) => { const n = [...comps]; n[i] = { ...n[i], [key]: value }; onChange(n); };
  const add = () => onChange([...(comps || []), { address: '', suburb: null, asset_class: null, nla_sqm: null, rent_pa: null, rent_per_sqm: null, lease_date: null, term_years: null, notes: null }]);
  const remove = (i) => onChange(comps.filter((_, j) => j !== i));

  if (!comps || comps.length === 0) {
    return (
      <div>
        <p className="text-xs text-brand-100/30 italic mb-2">No leasing comps in this IM.</p>
        <button onClick={add} className="text-xs text-brand-500 hover:text-brand-400 transition-colors">+ Add comp</button>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="text-xs min-w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {LEASE_COLS.map((c) => (
                <th key={c.key} className={`text-left py-2 px-2 text-[10px] uppercase tracking-wider text-brand-100/30 font-medium ${c.w} ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                {LEASE_COLS.map((col) => (
                  <td key={col.key} className={`py-1 px-1 ${col.align === 'right' ? 'text-right' : ''}`}>
                    <input
                      className={`w-full bg-transparent py-1 px-1.5 rounded text-brand-50 focus:bg-white/[0.04] focus:outline-none transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                      value={c[col.key] ?? ''}
                      onChange={(e) => update(i, col.key, col.type === 'number' ? numberOrNull(e.target.value) : (e.target.value || null))}
                    />
                  </td>
                ))}
                <td><button onClick={() => remove(i)} className="p-1 text-brand-100/20 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={add} className="text-xs text-brand-500 hover:text-brand-400 transition-colors mt-3 flex items-center gap-1"><Plus className="w-3 h-3" /> Add comp</button>
    </div>
  );
}

// ─── ExtractionView ───────────────────────────────────────────────────────────

export function ExtractionView({ extraction, onReset }) {
  const saveEdits = useMutation(api.imExtraction.saveEdits);
  const deleteExtraction = useMutation(api.imExtraction.deleteExtraction);

  // Draft = working copy of parsed result. null means unmodified.
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const base = extraction?.result ? JSON.parse(extraction.result) : null;
  const data = draft ?? base;
  const isDirty = draft !== null;

  if (!data) return null;

  const set = (path, value) => setDraft(setIn(draft ?? base, path, value));
  const setArr = (key, value) => setDraft({ ...(draft ?? base), [key]: value });

  const conf = data._confidence || {};
  const sp = data.subject_property || {};
  const fin = data.financial || {};
  const sale = data.sale_process || {};
  const comps = data.comps_in_im || { sales: [], leasing: [] };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveEdits({ id: extraction._id, result: JSON.stringify(draft) });
      setDraft(null);
      toast.success('Edits saved');
    } catch (e) {
      toast.error('Save failed', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteExtraction({ id: extraction._id });
      toast.info('Extraction deleted');
      onReset();
    } catch (e) {
      toast.error('Delete failed', { description: e.message });
    }
  };

  const handleCopy = (kind) => {
    const text = kind === 'row' ? buildSheetRow(data) : JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() =>
      toast.success(kind === 'row' ? 'Sheet row copied' : 'JSON copied')
    );
  };

  return (
    <div className="flex flex-col bg-[#050505] min-h-full">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0A] border-b border-white/5 px-6 lg:px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-0.5">Oracle IM Scanner</p>
          <h1 className="text-lg font-semibold text-white truncate">
            {sp.address?.full || extraction.filename}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {extraction.model && (
              <span className="flex items-center gap-1 text-[10px] text-brand-100/30">
                <Cpu className="w-3 h-3" />{extraction.model}
              </span>
            )}
            {extraction.latencyMs && (
              <span className="flex items-center gap-1 text-[10px] text-brand-100/30">
                <Clock className="w-3 h-3" />{(extraction.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-4">
          {isDirty && (
            <button
              onClick={() => setDraft(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-100/50 hover:text-brand-100/80 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </button>
          )}
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-950 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 rounded-md transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save edits'}
            </button>
          )}
          <button
            onClick={() => handleCopy('json')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-100/50 hover:text-brand-100/80 border border-white/[0.08] rounded-md transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />JSON
          </button>
          <button
            onClick={() => handleCopy('row')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-100/50 hover:text-brand-100/80 border border-white/[0.08] rounded-md transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />Sheet row
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs text-brand-100/50 hover:text-brand-100/80 border border-white/[0.08] rounded-md transition-colors"
          >
            New scan
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 lg:px-8 py-6 max-w-5xl">

        {/* Subject property */}
        <SectionCard title="Subject Property" badge={conf.address ? `address: ${conf.address}` : null}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Full address" value={sp.address?.full} conf={conf.address}
              onChange={(v) => set('subject_property.address.full', v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Suburb" value={sp.address?.suburb} onChange={(v) => set('subject_property.address.suburb', v)} />
              <Field label="State" value={sp.address?.state} onChange={(v) => set('subject_property.address.state', v)} />
              <Field label="Postcode" value={sp.address?.postcode} onChange={(v) => set('subject_property.address.postcode', v)} />
            </div>
            <Field label="NLA" value={sp.nla_sqm} suffix="m²" type="number" conf={conf.nla_sqm}
              onChange={(v) => set('subject_property.nla_sqm', v)} />
            <Field label="Building area" value={sp.building_area_sqm} suffix="m²" type="number" conf={conf.building_area_sqm}
              onChange={(v) => set('subject_property.building_area_sqm', v)} />
            <Field label="Land size" value={sp.land_size_sqm} suffix="m²" type="number" conf={conf.land_size_sqm}
              onChange={(v) => set('subject_property.land_size_sqm', v)} />
            <Field label="Asset class" value={sp.asset_class} conf={conf.asset_class}
              onChange={(v) => set('subject_property.asset_class', v)} />
            <Field label="Zoning" value={sp.zoning} conf={conf.zoning}
              onChange={(v) => set('subject_property.zoning', v)} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Title type" value={sp.title_type} onChange={(v) => set('subject_property.title_type', v)} />
              <Field label="Year built" value={sp.year_built} type="number" onChange={(v) => set('subject_property.year_built', v)} />
              <Field label="Car spaces" value={sp.car_spaces} type="number" onChange={(v) => set('subject_property.car_spaces', v)} />
            </div>
          </div>
        </SectionCard>

        {/* Tenancy schedule */}
        <SectionCard title="Tenancy Schedule" badge={`${(data.tenancies || []).length} tenant${(data.tenancies || []).length !== 1 ? 's' : ''}`}>
          <TenancyTable
            tenancies={data.tenancies || []}
            onChange={(v) => setArr('tenancies', v)}
          />
        </SectionCard>

        {/* Financial */}
        <SectionCard title="Financial">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-6">
            <Field label="Asking price" value={fin.asking_price} type="number" conf={conf.asking_price}
              onChange={(v) => set('financial.asking_price', v)} />
            <Field label="Asking text (EOI / auction / on application)" value={fin.asking_price_text}
              onChange={(v) => set('financial.asking_price_text', v)} />
            <Field label="Passing rent (total pa)" value={fin.passing_rent_total_pa} type="number" conf={conf.passing_rent_total_pa}
              onChange={(v) => set('financial.passing_rent_total_pa', v)} />
            <Field label="Rent basis" value={fin.rent_basis}
              onChange={(v) => set('financial.rent_basis', v)} />
            <Field label="Cap rate (stated by agent)" value={fin.cap_rate_stated_pct} suffix="%" type="number" conf={conf.cap_rate_stated_pct}
              onChange={(v) => set('financial.cap_rate_stated_pct', v)} />
            <Field label="Cap rate (calculated)" value={fin.cap_rate_calculated_pct} suffix="%" type="number"
              onChange={(v) => set('financial.cap_rate_calculated_pct', v)} />
            <Field label="Outgoings total" value={fin.outgoings_total_pa} type="number"
              onChange={(v) => set('financial.outgoings_total_pa', v)} />
            <Field label="Non-recoverable" value={fin.non_recoverable_total_pa} type="number"
              onChange={(v) => set('financial.non_recoverable_total_pa', v)} />
            <Field label="GST treatment" value={fin.gst_treatment}
              onChange={(v) => set('financial.gst_treatment', v)} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-brand-100/35 mb-3">Outgoings line items</p>
            <OutgoingsTable
              items={fin.outgoings_line_items || []}
              onChange={(v) => set('financial.outgoings_line_items', v)}
            />
          </div>
        </SectionCard>

        {/* Sales comps */}
        <SectionCard title="Sales Comps in IM" badge={`${(comps.sales || []).length} comp${(comps.sales || []).length !== 1 ? 's' : ''}`}>
          <SalesCompsTable
            comps={comps.sales || []}
            onChange={(v) => set('comps_in_im.sales', v)}
          />
        </SectionCard>

        {/* Leasing comps */}
        <SectionCard title="Leasing Comps in IM" badge={`${(comps.leasing || []).length} comp${(comps.leasing || []).length !== 1 ? 's' : ''}`}>
          <LeasingCompsTable
            comps={comps.leasing || []}
            onChange={(v) => set('comps_in_im.leasing', v)}
          />
        </SectionCard>

        {/* Sale process */}
        <SectionCard title="Sale Process">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Method" value={sale.sale_method} conf={conf.sale_method}
              onChange={(v) => set('sale_process.sale_method', v)} />
            <Field label="Vendor" value={sale.vendor}
              onChange={(v) => set('sale_process.vendor', v)} />
            <Field label="Auction / EOI details" value={sale.auction_details}
              onChange={(v) => set('sale_process.auction_details', v)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agent firm" value={sale.agent_firm}
                onChange={(v) => set('sale_process.agent_firm', v)} />
              <Field label="Agent name" value={sale.agent_name}
                onChange={(v) => set('sale_process.agent_name', v)} />
            </div>
          </div>
        </SectionCard>

        {/* Other useful info */}
        <SectionCard title="Other Useful Info">
          <Field label="" value={data.other_useful_info} multiline
            placeholder="Free-text catch-all — DA approvals, dev upside, tenancy mix, planning overlays, environmental notes…"
            onChange={(v) => setDraft({ ...(draft ?? base), other_useful_info: v })} />
        </SectionCard>

        {/* Danger zone */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] flex justify-end">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-100/25 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete extraction
          </button>
        </div>
      </div>
    </div>
  );
}
