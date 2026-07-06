import React from 'react';
import { CalendarClock, AlertCircle, Clock, CheckCircle } from 'lucide-react';

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtRent(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return '$' + Math.round(n).toLocaleString();
  return '$' + n;
}

function reviewStatus(reviewDate) {
  if (!reviewDate) return 'unknown';
  const diff = new Date(reviewDate) - new Date();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'overdue';
  if (days <= 90) return 'soon';
  return 'upcoming';
}

function daysLabel(reviewDate) {
  if (!reviewDate) return null;
  const diff = new Date(reviewDate) - new Date();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}

const statusConfig = {
  overdue: {
    icon: AlertCircle,
    badge: 'text-red-400 bg-red-500/10 border-red-500/20',
    row: 'bg-red-500/[0.03]',
    dot: 'bg-red-400',
    label: 'Overdue',
  },
  soon: {
    icon: Clock,
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    row: 'bg-amber-500/[0.03]',
    dot: 'bg-amber-400',
    label: 'Due Soon',
  },
  upcoming: {
    icon: CheckCircle,
    badge: 'text-brand-100/50 bg-white/[0.03] border-white/[0.06]',
    row: '',
    dot: 'bg-brand-500/50',
    label: 'Upcoming',
  },
  unknown: {
    icon: CalendarClock,
    badge: 'text-brand-100/45 bg-transparent border-transparent',
    row: '',
    dot: 'bg-brand-100/20',
    label: '—',
  },
};

export function RentReviewsTab({ property }) {
  const tenants = property.tenants || [];

  // Build review list: include tenants that have a reviewType and some review-relevant data
  const reviewRows = tenants
    .filter((t) => t.reviewType && t.reviewType !== 'None')
    .sort((a, b) => {
      // Sort: overdue first, then by nextReviewDate asc, then no date last
      const da = a.nextReviewDate ? new Date(a.nextReviewDate) : new Date('9999-12-31');
      const db = b.nextReviewDate ? new Date(b.nextReviewDate) : new Date('9999-12-31');
      return da - db;
    });

  const overdueCount = reviewRows.filter(
    (t) => t.nextReviewDate && reviewStatus(t.nextReviewDate) === 'overdue'
  ).length;
  const soonCount = reviewRows.filter(
    (t) => t.nextReviewDate && reviewStatus(t.nextReviewDate) === 'soon'
  ).length;

  return (
    <div className="max-w-5xl mx-auto">

      {/* Summary chips */}
      {reviewRows.length > 0 && (overdueCount > 0 || soonCount > 0) && (
        <div className="flex flex-wrap gap-2 mb-6">
          {overdueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-semibold text-red-400">
                {overdueCount} overdue review{overdueCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {soonCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">
                {soonCount} due within 90 days
              </span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Table header */}
        <div className="bg-[#0A0A0A] px-5 py-3 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
            Rent Review Schedule
          </p>
        </div>

        {reviewRows.length === 0 ? (
          <div className="py-20 text-center">
            <CalendarClock className="w-10 h-10 text-brand-100/40 mx-auto mb-3" />
            <p className="text-sm text-brand-100/40 mb-1">No rent reviews scheduled</p>
            <p className="text-xs text-brand-100/40 max-w-sm mx-auto">
              Add tenants with review type and next review dates in the Tenancy Schedule tab to see them here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#0f0f0f]">
                  {['Tenant', 'Suite', 'Current Rent', 'Review Type', 'Next Review', 'Due In', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-brand-100/40 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {reviewRows.map((tenant) => {
                  const status = tenant.nextReviewDate
                    ? reviewStatus(tenant.nextReviewDate)
                    : 'unknown';
                  const cfg = statusConfig[status];
                  const Icon = cfg.icon;
                  const days = daysLabel(tenant.nextReviewDate);

                  return (
                    <tr key={tenant.id} className={`transition-colors hover:bg-white/[0.02] ${cfg.row}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="font-medium text-brand-50 whitespace-nowrap">
                            {tenant.tenantName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-100/50 whitespace-nowrap">
                        {tenant.suite || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-100/70 whitespace-nowrap tabular-nums font-medium">
                        {fmtRent(tenant.netFaceRent)}
                        {tenant.lettableArea && tenant.netFaceRent ? (
                          <span className="ml-1 text-brand-100/40 font-normal">
                            (${Math.round(tenant.netFaceRent / tenant.lettableArea)}/sqm)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className="text-brand-100/60">
                          {tenant.reviewType}
                          {tenant.reviewType === 'Fixed %' && tenant.reviewRate
                            ? ` @ ${tenant.reviewRate}%`
                            : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-100/70 whitespace-nowrap tabular-nums">
                        {fmtDate(tenant.nextReviewDate)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap tabular-nums">
                        {days ? (
                          <span className={`font-semibold ${
                            status === 'overdue' ? 'text-red-400' :
                            status === 'soon' ? 'text-amber-400' :
                            'text-brand-100/60'
                          }`}>
                            {days}
                          </span>
                        ) : (
                          <span className="text-brand-100/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${cfg.badge}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Lease expiry section */}
        {tenants.filter((t) => t.leaseEnd).length > 0 && (
          <>
            <div className="border-t border-white/[0.06] bg-[#0A0A0A] px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
                Lease Expiry Schedule
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-[#0f0f0f]">
                    {['Tenant', 'Suite', 'Lease End', 'Expires In', 'Options'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-brand-100/40 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[...tenants]
                    .filter((t) => t.leaseEnd)
                    .sort((a, b) => new Date(a.leaseEnd) - new Date(b.leaseEnd))
                    .map((tenant) => {
                      const diff = new Date(tenant.leaseEnd) - new Date();
                      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                      const isExpired = days < 0;
                      const isUrgent = days >= 0 && days < 365;
                      return (
                        <tr key={`exp-${tenant.id}`} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-medium text-brand-50 whitespace-nowrap">
                            {tenant.tenantName}
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-100/50 whitespace-nowrap">
                            {tenant.suite || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-100/70 tabular-nums whitespace-nowrap">
                            {fmtDate(tenant.leaseEnd)}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            <span className={`font-semibold tabular-nums ${
                              isExpired ? 'text-red-400' :
                              isUrgent ? 'text-amber-400' :
                              'text-brand-100/60'
                            }`}>
                              {daysLabel(tenant.leaseEnd)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-100/50 whitespace-nowrap">
                            {tenant.options || <span className="text-brand-100/40">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
