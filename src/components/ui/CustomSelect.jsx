import React from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CustomSelect — wraps Headless UI Listbox with Oracle's dark theme.
 *
 * Props:
 *   value        — current value (string or the `.value` of an option object)
 *   onChange     — called with the new value (or option.value)
 *   options      — array of strings OR { value, label } objects
 *   placeholder  — text shown when value is empty/falsy
 *   variant      — 'default' | 'pill' | 'status-pill' | 'priority' | 'form' | 'compact'
 *   error        — boolean — highlights border red
 *   disabled     — boolean — dims and prevents interaction
 *   className    — added to the outer wrapper div
 */
export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = '',
  variant = 'default',
  error = false,
  disabled = false,
  className = '',
}) {
  // Normalise every option to { value, label }
  const normOpts = options.map((o) =>
    typeof o === 'object' && o !== null ? o : { value: o, label: String(o) }
  );

  // Derive display text for the current value
  const selected = normOpts.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? String(value) : '');
  const isEmpty = !value && !displayLabel;
  const showPlaceholder = isEmpty && placeholder;

  // ─── Button styles per variant ──────────────────────────────────────────────

  const borderColor = error ? 'border-red-500/40' : undefined;

  const buttonStyles = {
    default:
      `pl-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer bg-[#111] border ${borderColor ?? 'border-white/5'} hover:border-white/10 text-white shadow-inner`,
    pill:
      `px-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer bg-brand-500/10 text-brand-400 border ${borderColor ?? 'border-brand-500/20'} hover:bg-brand-500/20`,
    'status-pill': (() => {
      let col = `bg-brand-800/10 text-brand-100/50 border-brand-800/20`;
      if (value === 'On Market')   col = `bg-green-500/10  text-green-400  border-green-500/20`;
      if (value === 'Off Market')  col = `bg-purple-500/10 text-purple-400 border-purple-500/20`;
      if (value === 'Under Offer') col = `bg-yellow-500/10 text-yellow-400 border-yellow-500/20`;
      if (value === 'Sold')        col = `bg-blue-500/10   text-blue-400   border-blue-500/20`;
      return `px-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer border ${col}`;
    })(),
    priority:
      `pl-7 pr-6 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer bg-[#111] border ${borderColor ?? 'border-white/5'} hover:border-white/10 text-white shadow-inner`,
    // form / compact use flex layout — chevron is inline, not absolute
    form:
      `w-full bg-[#111] border ${borderColor ?? 'border-white/5'} rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors shadow-inner`,
    compact:
      `w-full bg-[#111] border ${borderColor ?? 'border-brand-800/50'} rounded-md px-3 py-1.5 text-xs text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors`,
  }[variant] ?? '';

  const isFlexVariant = variant === 'form' || variant === 'compact';
  const dropdownTextSize = variant === 'compact' ? 'text-xs' : 'text-sm';
  const dropdownItemPy = variant === 'compact' ? 'py-1.5' : 'py-2';

  const renderPriorityDot = (val) => {
    if (val === 'High')   return <div className="w-2 h-2 rounded-full bg-red-500    shadow-[0_0_8px_rgba(239,68,68,0.6)]" />;
    if (val === 'Medium') return <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />;
    return                       <div className="w-2 h-2 rounded-full bg-blue-500   shadow-[0_0_8px_rgba(59,130,246,0.6)]" />;
  };

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        {({ open }) => (
          <>
            <Listbox.Button
              className={`relative flex items-center w-full ${buttonStyles} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Priority dot — left of text */}
              {variant === 'priority' && !showPlaceholder && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  {renderPriorityDot(value)}
                </span>
              )}

              {/* Label / placeholder */}
              <span className={`block truncate ${isFlexVariant ? 'flex-1 text-left' : ''} ${showPlaceholder ? 'text-brand-100/45' : ''}`}>
                {showPlaceholder ? placeholder : displayLabel}
              </span>

              {/* Chevron */}
              {isFlexVariant ? (
                <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-2" aria-hidden />
              ) : (
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronDown className="h-3 w-3 opacity-50" aria-hidden />
                </span>
              )}
            </Listbox.Button>

            <AnimatePresence>
              {open && (
                <Listbox.Options
                  static
                  as={motion.ul}
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
                  className={`absolute z-50 mt-1 max-h-60 w-max min-w-full overflow-auto rounded-md bg-[#0A0A0A]/95 p-1 ${dropdownTextSize} shadow-2xl border border-white/5 backdrop-blur-md focus:outline-none`}
                >
                  {normOpts.map((opt) => (
                    <Listbox.Option
                      key={opt.value}
                      value={opt.value}
                      className={({ active }) =>
                        `relative cursor-default select-none ${dropdownItemPy} pl-8 pr-4 rounded-sm transition-colors ${
                          active ? 'bg-white/10 text-white' : 'text-brand-100/70'
                        }`
                      }
                    >
                      {({ selected: isSel }) => (
                        <>
                          <div className="flex items-center gap-2">
                            {variant === 'priority' && renderPriorityDot(opt.value)}
                            <span className={`block truncate ${isSel ? 'font-medium text-brand-400' : 'font-normal'}`}>
                              {opt.label}
                            </span>
                          </div>
                          {isSel && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-brand-400">
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              )}
            </AnimatePresence>
          </>
        )}
      </Listbox>
    </div>
  );
}
