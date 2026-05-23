import React from 'react';

/**
 * Shared icon button primitive for all record workspace toolbars.
 * Variants: 'default' | 'primary' | 'danger'
 */
export function IconButton({ icon: Icon, label, onClick, variant = 'default', active = false, className = '' }) {
  const base = 'w-8 h-8 rounded-md flex items-center justify-center transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500/50 shrink-0';

  const variants = {
    default: `bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.12] ${active ? 'bg-white/[0.07] border-white/[0.12] text-brand-400' : 'text-brand-100/40 hover:text-brand-100/80'}`,
    primary: `bg-brand-500/10 border border-brand-500/25 hover:bg-brand-500/20 hover:border-brand-500/40 text-brand-400 hover:text-brand-300`,
    danger: `bg-white/[0.02] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 text-brand-100/40 hover:text-red-400`,
  };

  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      <Icon className="w-4 h-4" strokeWidth={1.75} />
    </button>
  );
}

/** Thin vertical divider between icon groups */
export function ToolbarDivider() {
  return <div className="w-px h-4 bg-white/[0.06] shrink-0" />;
}
