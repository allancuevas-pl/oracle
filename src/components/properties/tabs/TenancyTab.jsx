import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Users, DollarSign, TrendingUp, Building } from 'lucide-react';
import { toast } from 'sonner';
import { CustomSelect } from '../../ui/CustomSelect';

// ─── Helpers ────────────────────────────────────────────────────────────────

const genId = () => `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtRent(val) {
  if (!val) return '—';
  if (val >= 1_000_000) return '$' + (val / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (val >= 1_000) return '$' + Math.round(val).toLocaleString();
  return '$' + val;
}

function fmtSqm(val) {
  if (!val) return '—';
  return val.toLocaleString();
}

function calcPsm(rent, area) {
  if (!rent || !area) return null;
  return (rent / area).toFixed(0);
}

function expiresIn(leaseEnd) {
  if (!leaseEnd) return { label: '—', urgency: 'none' };
  const diff = new Date(leaseEnd) - new Date();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Expired', urgency: 'expired' };
  if (days < 90) return { label: days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`, urgency: 'urgent' };
  if (days < 365) return { label: `${Math.floor(days / 30)}mo`, urgency: 'warning' };
  return { label: `${(days / 365).toFixed(1)}yr`, urgency: 'ok' };
}

const urgencyClass = {
  expired: 'text-red-400 bg-red-500/10 border-red-500/20',
  urgent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  warning: 'text-yellow-500/80 bg-yellow-500/10 border-yellow-500/20',
  ok: 'text-brand-100/50 bg-white/[0.03] border-white/[0.06]',
  none: 'text-brand-100/30 bg-transparent border-transparent',
};

const EMPTY_TENANT = {
  tenantName: '',
  suite: '',
  lettableArea: '',
  leaseStart: '',
  leaseEnd: '',
  netFaceRent: '',
  leaseType: 'Net',
  reviewType: 'CPI',
  reviewRate: '',
  nextReviewDate: '',
  options: '',
};

const INPUT_CLS = 'w-full bg-[#1a1a1a] border border-brand-800/60 rounded px-2 py-1.5 text-sm text-brand-50 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/10 placeholder:text-brand-100/20';
const LABEL_CLS = 'block text-[10px] uppercase tracking-wider text-brand-100/40 mb-1';

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ tenants, buildingArea }) {
  const totalRent = tenants.reduce((s, t) => s + (Number(t.netFaceRent) || 0), 0);
  const totalArea = tenants.reduce((s, t) => s + (Number(t.lettableArea) || 0), 0);
  const occupancyPct = buildingArea
    ? Math.min(100, Math.round((totalArea / buildingArea) * 100))
    : null;
  const avgPsm = totalArea > 0 && totalRent > 0 ? (totalRent / totalArea).toFixed(0) : null;

  const stats = [
    { label: 'Tenants', value: tenants.length || '—', icon: Users },
    {
      label: 'Net Passing Rent',
      value: totalRent > 0 ? fmtRent(totalRent) + '/pa' : '—',
      icon: DollarSign,
    },
    {
      label: 'Occupancy',
      value: occupancyPct !== null ? `${occupancyPct}%` : totalArea > 0 ? `${fmtSqm(totalArea)} sqm` : '—',
      icon: Building,
    },
    {
      label: '$/sqm avg',
      value: avgPsm ? `$${Number(avgPsm).toLocaleString()}/sqm` : '—',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.06] mb-6">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-[#0A0A0A] px-4 py-3 flex items-center gap-3">
          <Icon className="w-4 h-4 text-brand-500/50 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-brand-100/40">{label}</p>
            <p className="text-sm font-semibold text-brand-50 mt-0.5">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Edit panel ───────────────────────────────────────────────────────────────

function EditPanel({ data, onChange, onSave, onCancel, isNew }) {
  return (
    <div className="bg-[#0d0d0d] border-t-2 border-brand-500/30 px-5 py-4">
      <p className="text-[10px] uppercase tracking-widest text-brand-500/70 mb-3">
        {isNew ? 'New Tenant' : 'Edit Tenant'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
        <div className="lg:col-span-2">
          <label className={LABEL_CLS}>Tenant Name *</label>
          <input
            type="text"
            value={data.tenantName || ''}
            onChange={(e) => onChange({ tenantName: e.target.value })}
            className={INPUT_CLS}
            placeholder="e.g. Woolworths"
            autoFocus
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Suite / Level</label>
          <input
            type="text"
            value={data.suite || ''}
            onChange={(e) => onChange({ suite: e.target.value })}
            className={INPUT_CLS}
            placeholder="e.g. T1.01"
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Area (sqm)</label>
          <input
            type="number"
            value={data.lettableArea || ''}
            onChange={(e) => onChange({ lettableArea: e.target.value })}
            className={INPUT_CLS}
            placeholder="0"
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Lease Start</label>
          <input
            type="date"
            value={data.leaseStart || ''}
            onChange={(e) => onChange({ leaseStart: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Lease End</label>
          <input
            type="date"
            value={data.leaseEnd || ''}
            onChange={(e) => onChange({ leaseEnd: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Net Rent $/pa</label>
          <input
            type="number"
            value={data.netFaceRent || ''}
            onChange={(e) => onChange({ netFaceRent: e.target.value })}
            className={INPUT_CLS}
            placeholder="0"
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Lease Type</label>
          <CustomSelect
            value={data.leaseType || 'Net'}
            onChange={(v) => onChange({ leaseType: v })}
            options={['Net', 'Gross', 'Semi-Gross']}
            variant="compact"
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Review Type</label>
          <CustomSelect
            value={data.reviewType || 'CPI'}
            onChange={(v) => onChange({ reviewType: v })}
            options={['CPI', 'Fixed %', 'Market', 'None']}
            variant="compact"
          />
        </div>
        {data.reviewType === 'Fixed %' && (
          <div>
            <label className={LABEL_CLS}>Fixed Rate %</label>
            <input
              type="number"
              step="0.1"
              value={data.reviewRate || ''}
              onChange={(e) => onChange({ reviewRate: e.target.value })}
              className={INPUT_CLS}
              placeholder="e.g. 3.5"
            />
          </div>
        )}
        <div>
          <label className={LABEL_CLS}>Next Review</label>
          <input
            type="date"
            value={data.nextReviewDate || ''}
            onChange={(e) => onChange({ nextReviewDate: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL_CLS}>Options</label>
          <input
            type="text"
            value={data.options || ''}
            onChange={(e) => onChange({ options: e.target.value })}
            className={INPUT_CLS}
            placeholder="e.g. 2 x 3yr"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-brand-100/60 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-4 py-1.5 text-xs font-semibold bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-md transition-colors flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {isNew ? 'Add Tenant' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TenancyTab({ property, updateTenants }) {
  const tenants = property.tenants || [];
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState(null);
  const [pendingNew, setPendingNew] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const allRows = pendingNew ? [...tenants, pendingNew] : tenants;

  function handleEdit(tenant) {
    if (pendingNew) {
      setPendingNew(null);
    }
    setEditingId(tenant.id);
    setEditingData({ ...tenant });
  }

  function handleAddTenant() {
    const newTenant = { id: genId(), ...EMPTY_TENANT };
    setPendingNew(newTenant);
    setEditingId(newTenant.id);
    setEditingData({ ...newTenant });
  }

  function handleChange(patch) {
    setEditingData((d) => ({ ...d, ...patch }));
  }

  async function handleSave() {
    if (!editingData?.tenantName?.trim()) {
      toast.error('Tenant name is required');
      return;
    }
    setIsSaving(true);
    try {
      const coerced = {
        ...editingData,
        lettableArea: editingData.lettableArea ? Number(editingData.lettableArea) : undefined,
        netFaceRent: editingData.netFaceRent ? Number(editingData.netFaceRent) : undefined,
        reviewRate: editingData.reviewRate ? Number(editingData.reviewRate) : undefined,
        suite: editingData.suite || undefined,
        leaseStart: editingData.leaseStart || undefined,
        leaseEnd: editingData.leaseEnd || undefined,
        leaseType: editingData.leaseType || undefined,
        reviewType: editingData.reviewType || undefined,
        nextReviewDate: editingData.nextReviewDate || undefined,
        options: editingData.options || undefined,
      };

      let newTenants;
      if (pendingNew && editingId === pendingNew.id) {
        newTenants = [...tenants, coerced];
        setPendingNew(null);
      } else {
        newTenants = tenants.map((t) => (t.id === editingId ? coerced : t));
      }

      await updateTenants({ id: property._id, tenants: newTenants });
      setEditingId(null);
      setEditingData(null);
      toast.success(pendingNew ? 'Tenant added' : 'Tenant updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save tenant');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setPendingNew(null);
    setEditingId(null);
    setEditingData(null);
  }

  async function handleDelete(tenantId) {
    const newTenants = tenants.filter((t) => t.id !== tenantId);
    try {
      await updateTenants({ id: property._id, tenants: newTenants });
      if (editingId === tenantId) handleCancel();
      toast.success('Tenant removed');
    } catch (err) {
      toast.error('Failed to remove tenant');
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <SummaryStrip tenants={tenants} buildingArea={property.buildingArea} />

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Table header */}
        <div className="bg-[#0A0A0A] border-b border-white/[0.06]">
          <div className="flex items-center px-5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
              Tenancy Schedule
            </p>
            <span className="ml-3 text-[10px] text-brand-100/30">
              {tenants.length} tenant{tenants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#0f0f0f]">
                {['Tenant', 'Suite', 'Area (sqm)', 'Lease End', 'Net Rent', '$/sqm', 'Type', 'Review', 'Expires', ''].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-brand-100/40 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {allRows.length === 0 && !pendingNew ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-brand-900/30 border border-brand-800/50 flex items-center justify-center">
                        <Users className="w-5 h-5 text-brand-500/50" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-brand-100/50 mb-1">No tenants recorded</p>
                        <p className="text-xs text-brand-100/30">
                          Add tenants to build out the rent roll and see occupancy metrics.
                        </p>
                      </div>
                      <button
                        onClick={handleAddTenant}
                        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add First Tenant
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                allRows.map((tenant) => {
                  const isEditing = editingId === tenant.id;
                  const isNew = pendingNew?.id === tenant.id;
                  const exp = expiresIn(tenant.leaseEnd);
                  const psm = calcPsm(tenant.netFaceRent, tenant.lettableArea);

                  return (
                    <React.Fragment key={tenant.id}>
                      {/* Read row */}
                      <tr
                        className={`group transition-colors ${
                          isEditing
                            ? 'bg-brand-900/10'
                            : 'hover:bg-white/[0.02] cursor-pointer'
                        }`}
                        onClick={() => !isEditing && handleEdit(tenant)}
                      >
                        <td className="px-4 py-3 font-medium text-brand-50 whitespace-nowrap">
                          {isNew ? (
                            <span className="text-brand-100/30 italic text-xs">New tenant...</span>
                          ) : (
                            tenant.tenantName
                          )}
                        </td>
                        <td className="px-4 py-3 text-brand-100/60 text-xs whitespace-nowrap">
                          {tenant.suite || '—'}
                        </td>
                        <td className="px-4 py-3 text-brand-100/70 text-xs whitespace-nowrap tabular-nums">
                          {fmtSqm(tenant.lettableArea)}
                        </td>
                        <td className="px-4 py-3 text-brand-100/70 text-xs whitespace-nowrap tabular-nums">
                          {fmtDate(tenant.leaseEnd)}
                        </td>
                        <td className="px-4 py-3 text-brand-50 text-xs whitespace-nowrap tabular-nums font-medium">
                          {fmtRent(tenant.netFaceRent)}
                        </td>
                        <td className="px-4 py-3 text-brand-100/50 text-xs whitespace-nowrap tabular-nums">
                          {psm ? `$${Number(psm).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {tenant.leaseType ? (
                            <span className="text-brand-100/60">{tenant.leaseType}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {tenant.reviewType ? (
                            <span className="text-brand-100/60">
                              {tenant.reviewType}
                              {tenant.reviewType === 'Fixed %' && tenant.reviewRate
                                ? ` ${tenant.reviewRate}%`
                                : ''}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {exp.label !== '—' ? (
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${urgencyClass[exp.urgency]}`}>
                              {exp.label}
                            </span>
                          ) : (
                            <span className="text-brand-100/25">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div
                            className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleEdit(tenant)}
                              className="p-1.5 rounded hover:bg-white/[0.06] text-brand-100/40 hover:text-brand-400 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tenant.id)}
                              className="p-1.5 rounded hover:bg-red-500/10 text-brand-100/40 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Edit panel row */}
                      {isEditing && editingData && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <EditPanel
                              data={editingData}
                              onChange={handleChange}
                              onSave={handleSave}
                              onCancel={handleCancel}
                              isNew={isNew}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add tenant footer */}
        {allRows.length > 0 && !pendingNew && (
          <div className="border-t border-white/[0.04] bg-[#0A0A0A]">
            <button
              onClick={handleAddTenant}
              className="w-full flex items-center gap-2 px-5 py-3 text-xs text-brand-100/40 hover:text-brand-400 hover:bg-brand-500/5 transition-colors group"
            >
              <Plus className="w-3.5 h-3.5 group-hover:text-brand-500 transition-colors" />
              Add Tenant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
