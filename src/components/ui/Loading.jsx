import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Shared loading primitives — one consistent treatment across every screen.
 *
 *  • <Spinner>       inline spinner at a fixed brand size
 *  • <PageLoader>    centered loader for a whole view / record (detail pages)
 *  • <SkeletonTable> content-shaped placeholder for list/table views (no layout shift)
 */

export function Spinner({ className = 'w-6 h-6' }) {
  return <Loader2 className={`${className} text-brand-500 animate-spin`} />;
}

/** Full-area centered loader. Use for record/detail views and full-screen states. */
export function PageLoader({ label, className = '' }) {
  return (
    <div className={`flex flex-1 flex-col items-center justify-center min-h-[400px] gap-3 ${className}`}>
      <Spinner className="w-7 h-7" />
      {label && <p className="text-xs text-brand-100/40">{label}</p>}
    </div>
  );
}

/**
 * Skeleton rows for list/table views. Renders content-shaped bars that match the
 * eventual table so there's no jump when data arrives. `cols` controls how many
 * cells per row; the first cell is wider (the title/address column).
 */
export function SkeletonTable({ rows = 8, cols = 5, className = '' }) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-white/[0.03]"
          style={{ opacity: 1 - r * 0.06 }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={`h-3 rounded bg-white/[0.05] ${c === 0 ? 'w-[22%]' : 'flex-1 max-w-[110px]'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton grid for card layouts. */
export function SkeletonCards({ count = 6, className = '' }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl border border-white/[0.05] bg-white/[0.02] p-5 flex flex-col gap-3"
          style={{ opacity: 1 - i * 0.08 }}>
          <div className="h-3.5 w-2/3 rounded bg-white/[0.05]" />
          <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
          <div className="mt-auto h-3 w-1/2 rounded bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}
