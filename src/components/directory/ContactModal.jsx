import React, { useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const CATEGORIES = [
  { value: 'agent',      label: 'Agent' },
  { value: 'contractor', label: 'Contractor / Inspector' },
  { value: 'solicitor',  label: 'Solicitor / Conveyancer' },
  { value: 'broker',     label: 'Broker' },
  { value: 'other',      label: 'Other' },
];
const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['agent', 'contractor', 'solicitor', 'broker', 'other']),
  company: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  state: z.string().optional(),
  suburb: z.string().optional(),
  specialty: z.string().optional(),
  notes: z.string().optional(),
});

const inputCls = (err) =>
  `w-full bg-[#111] border ${err ? 'border-red-500/50' : 'border-brand-800/50'} rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20`;
const labelCls = 'block text-sm font-medium text-brand-100/70 mb-1';

export function ContactModal({ isOpen, onClose, editingContact }) {
  const createContact = useMutation(api.contacts.createContact);
  const updateContact = useMutation(api.contacts.updateContact);
  const deleteContact = useMutation(api.contacts.deleteContact);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', category: 'agent', company: '', email: '', phone: '', state: '', suburb: '', specialty: '', notes: '' },
  });

  useEffect(() => {
    if (!isOpen) return;
    // Reset form + delete-confirm state each time the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmDelete(false);
    reset({
      name: editingContact?.name || '',
      category: editingContact?.category || 'agent',
      company: editingContact?.company || '',
      email: editingContact?.email || '',
      phone: editingContact?.phone || '',
      state: editingContact?.state || '',
      suburb: editingContact?.suburb || '',
      specialty: editingContact?.specialty || '',
      notes: editingContact?.notes || '',
    });
  }, [isOpen, editingContact, reset]);

  const clean = (v) => (v && v.trim() ? v.trim() : undefined);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const payload = {
      name: data.name.trim(),
      category: data.category,
      company: clean(data.company),
      email: clean(data.email),
      phone: clean(data.phone),
      state: clean(data.state),
      suburb: clean(data.suburb),
      specialty: clean(data.specialty),
      notes: clean(data.notes),
    };
    try {
      if (editingContact) {
        await updateContact({ id: editingContact._id, ...payload });
        toast.success('Contact updated');
      } else {
        await createContact(payload);
        toast.success('Contact added');
      }
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to save contact.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteContact({ id: editingContact._id });
      toast.success('Contact deleted');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to delete.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full max-w-lg flex flex-col relative z-10 backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-medium text-brand-50 tracking-tight">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h2>
              <button onClick={onClose} className="text-brand-100/50 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form id="contact-form" onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="c-name" className={labelCls}>Name *</label>
                  <input id="c-name" {...register('name')} type="text" placeholder="e.g. Sarah Nguyen" className={inputCls(errors.name)} />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="c-category" className={labelCls}>Category *</label>
                  <select id="c-category" {...register('category')} className={inputCls(errors.category)}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="c-company" className={labelCls}>Company</label>
                  <input id="c-company" {...register('company')} type="text" placeholder="e.g. CBRE" className={inputCls()} />
                </div>
                <div>
                  <label htmlFor="c-specialty" className={labelCls}>Specialty / Role</label>
                  <input id="c-specialty" {...register('specialty')} type="text" placeholder="e.g. Building & Pest" className={inputCls()} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="c-email" className={labelCls}>Email</label>
                  <input id="c-email" {...register('email')} type="email" placeholder="name@company.com" className={inputCls(errors.email)} />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="c-phone" className={labelCls}>Phone</label>
                  <input id="c-phone" {...register('phone')} type="tel" placeholder="04XX XXX XXX" className={inputCls()} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="c-state" className={labelCls}>State</label>
                  <select id="c-state" {...register('state')} className={inputCls()}>
                    <option value="">Not specified</option>
                    {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="c-suburb" className={labelCls}>Suburb</label>
                  <input id="c-suburb" {...register('suburb')} type="text" placeholder="e.g. Parramatta" className={inputCls()} />
                </div>
              </div>

              <div>
                <label htmlFor="c-notes" className={labelCls}>Notes</label>
                <textarea id="c-notes" {...register('notes')} rows={3} placeholder="Any relevant background..." className={`${inputCls()} resize-none`} />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-brand-800/30 flex justify-between items-center">
              {editingContact ? (
                <button type="button" onClick={onDelete}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${confirmDelete ? 'bg-red-500/15 text-red-400 border border-red-500/30' : 'text-brand-100/50 hover:text-red-400'}`}>
                  <Trash2 className="w-4 h-4" />
                  {confirmDelete ? 'Click to confirm' : 'Delete'}
                </button>
              ) : <span />}
              <div className="flex space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-brand-100/70 hover:text-white transition-colors">Cancel</button>
                <button type="submit" form="contact-form" disabled={isSubmitting}
                  className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
