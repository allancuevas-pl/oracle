import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Receipt } from 'lucide-react';
import { toast } from 'sonner';

const genId = () => `o_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const PRESET_CATEGORIES = [
  'Land Tax',
  'Council Rates',
  'Building Insurance',
  'Management Fee',
  'Body Corporate / Strata',
  'Repairs & Maintenance',
  'Cleaning',
  'Security',
  'Other',
];

function fmtCurrency(val) {
  if (!val) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-AU');
}

const INPUT_CLS =
  'w-full bg-[#111] border border-brand-800/50 rounded px-2.5 py-1.5 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/10 placeholder:text-brand-100/40';

export function OutgoingsTab({ property, updateOutgoings }) {
  const [items, setItems] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync when property loads or changes
  useEffect(() => {
    setItems(
      (property.outgoings || []).map((o) => ({
        ...o,
        amount: o.amount?.toString() ?? '',
      }))
    );
    setIsDirty(false);
  }, [property._id]);

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  function addItem() {
    setItems((prev) => [...prev, { id: genId(), category: '', amount: '', notes: '' }]);
    setIsDirty(true);
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setIsDirty(true);
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    setIsDirty(true);
  }

  async function handleSave() {
    const coerced = items.map(({ id, category, amount, notes }) => ({
      id,
      category: category || 'Other',
      amount: Number(amount) || 0,
      ...(notes ? { notes } : {}),
    }));
    setIsSaving(true);
    try {
      await updateOutgoings({ id: property._id, outgoings: coerced });
      setIsDirty(false);
      toast.success('Outgoings saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save outgoings');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
              Outgoings Schedule
            </p>
            <p className="text-xs text-brand-100/40 mt-0.5">Annual property outgoings ($/pa)</p>
          </div>
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 text-xs font-semibold transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          )}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_160px_1fr_48px] gap-px bg-white/[0.03] border-b border-white/[0.06]">
          {['Category', 'Amount $/pa', 'Notes', ''].map((h) => (
            <div key={h} className="px-4 py-2 bg-[#0f0f0f]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-100/40">{h}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="w-8 h-8 text-brand-100/40 mx-auto mb-3" />
              <p className="text-sm text-brand-100/40 mb-1">No outgoings recorded</p>
              <p className="text-xs text-brand-100/40">
                Add annual outgoing line items to build the expense schedule.
              </p>
              <button
                onClick={addItem}
                className="mt-4 flex items-center gap-2 px-4 py-2 mx-auto rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Line Item
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_160px_1fr_48px] gap-px bg-[#0A0A0A] items-center"
              >
                <div className="px-4 py-2.5">
                  <input
                    list="outgoing-categories"
                    type="text"
                    value={item.category}
                    onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                    className={INPUT_CLS}
                    placeholder="e.g. Land Tax"
                  />
                  <datalist id="outgoing-categories">
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div className="px-4 py-2.5">
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                    className={INPUT_CLS}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="px-4 py-2.5">
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                    className={INPUT_CLS}
                    placeholder="Optional note"
                  />
                </div>
                <div className="px-3 py-2.5 flex justify-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-brand-100/45 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add row footer */}
        {items.length > 0 && (
          <div className="border-t border-white/[0.04] bg-[#0A0A0A]">
            <button
              onClick={addItem}
              className="w-full flex items-center gap-2 px-5 py-3 text-xs text-brand-100/40 hover:text-brand-400 hover:bg-brand-500/5 transition-colors group"
            >
              <Plus className="w-3.5 h-3.5 group-hover:text-brand-500 transition-colors" />
              Add Line Item
            </button>
          </div>
        )}

        {/* Totals footer */}
        {items.length > 0 && (
          <div className="border-t border-white/[0.08] bg-[#0f0f0f] px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-100/50">
              Total Outgoings
            </span>
            <span className="text-sm font-bold text-brand-50 tabular-nums">
              {fmtCurrency(totalAmount)}<span className="text-brand-100/40 font-normal text-xs ml-1">/pa</span>
            </span>
          </div>
        )}
      </div>

      {/* Save hint */}
      {isDirty && items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 text-sm font-semibold transition-colors shadow-[0_0_15px_rgba(212,175,55,0.15)]"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Outgoings'}
          </button>
        </div>
      )}
    </div>
  );
}
