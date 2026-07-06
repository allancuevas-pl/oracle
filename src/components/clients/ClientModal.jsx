import React, { useEffect, useState } from 'react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export function ClientModal({ isOpen, onClose, editingClient, onCreated }) {
  const createClient = useMutation(api.clients.createClient);
  const updateClient = useMutation(api.clients.updateClient);
  const sendPortalInvite = useAction(api.team.inviteTeamMember);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editingClient) {
        reset({
          name: editingClient.name || '',
          company: editingClient.company || '',
          email: editingClient.email || '',
          phone: editingClient.phone || '',
          notes: editingClient.notes || '',
        });
      } else {
        reset({ name: '', company: '', email: '', phone: '', notes: '' });
      }
    }
  }, [isOpen, editingClient, reset]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    const payload = {
      name: data.name,
      company: data.company || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      notes: data.notes || undefined,
    };

    try {
      if (editingClient) {
        await updateClient({ id: editingClient._id, ...payload });
        toast.success("Client updated");
        onClose();
      } else {
        const newId = await createClient(payload);
        toast.success("Client created");
        if (onCreated) onCreated({ _id: newId, ...payload });
        onClose();
        // Auto-send portal invite if email provided — fire-and-forget
        if (payload.email) {
          sendPortalInvite({ email: payload.email, role: 'client', clientRecordId: newId })
            .then(() => toast.success(`Portal invite sent to ${payload.email}`))
            .catch((err) => {
              const msg = err.message || '';
              if (msg.includes('email address is taken') || msg.includes('already')) {
                toast.success(`${payload.email} already has an account — role updated, they can sign in now`);
              } else {
                toast.error(`Client saved but invite failed: ${msg}`);
              }
            });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#050505]/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="bg-[#0A0A0A]/95 border border-white/5 rounded-xl shadow-2xl w-full max-w-lg flex flex-col relative z-10 backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-medium text-brand-50 tracking-tight">
                {editingClient ? "Edit Client" : "Add Client"}
              </h2>
              <button
                onClick={onClose}
                className="text-brand-100/50 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              {/* Name + Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="client-name" className="block text-sm font-medium text-brand-100/70 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="client-name"
                    {...register("name")}
                    type="text"
                    placeholder="e.g. James Smith"
                    className={`w-full bg-[#111] border ${errors.name ? 'border-red-500/50' : 'border-brand-800/50'} rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20`}
                  />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="client-company" className="block text-sm font-medium text-brand-100/70 mb-1">Company</label>
                  <input
                    id="client-company"
                    {...register("company")}
                    type="text"
                    placeholder="e.g. Smith Family Office"
                    className="w-full bg-[#111] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="client-email" className="block text-sm font-medium text-brand-100/70 mb-1">Email</label>
                  <input
                    id="client-email"
                    {...register("email")}
                    type="email"
                    placeholder="james@example.com"
                    className={`w-full bg-[#111] border ${errors.email ? 'border-red-500/50' : 'border-brand-800/50'} rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20`}
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="client-phone" className="block text-sm font-medium text-brand-100/70 mb-1">Phone</label>
                  <input
                    id="client-phone"
                    {...register("phone")}
                    type="tel"
                    placeholder="04XX XXX XXX"
                    className="w-full bg-[#111] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="client-notes" className="block text-sm font-medium text-brand-100/70 mb-1">Notes</label>
                <textarea
                  id="client-notes"
                  {...register("notes")}
                  rows={3}
                  placeholder="Any relevant background on this client..."
                  className="w-full bg-[#111] border border-brand-800/50 rounded-md px-3 py-2 text-sm text-brand-50 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 resize-none"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-brand-800/30 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-brand-100/70 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="client-form"
                disabled={isSubmitting}
                className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-brand-950 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingClient ? "Save Changes" : "Add Client"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
