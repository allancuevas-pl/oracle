import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  variant = 'default', // 'default', 'pill', 'priority'
  className = ''
}) {
  
  const getButtonStyles = () => {
    switch (variant) {
      case 'pill':
        return "appearance-none px-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20";
      case 'status-pill':
        // special coloring for status
        let colorClasses = 'bg-brand-800/10 text-brand-100/50 border-brand-800/20';
        if (value === 'On Market') colorClasses = 'bg-green-500/10 text-green-400 border-green-500/20';
        if (value === 'Off Market') colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        if (value === 'Under Offer') colorClasses = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        if (value === 'Sold') colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        return `appearance-none px-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border ${colorClasses}`;
      case 'priority':
        return "appearance-none pl-7 pr-6 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer bg-[#111] border border-white/5 hover:border-white/10 text-white shadow-inner";
      case 'form':
        return "w-full bg-[#111] border border-white/5 rounded-md px-4 py-2 text-sm text-brand-50 focus:border-brand-500/50 focus:outline-none transition-colors shadow-inner flex justify-between items-center";
      default:
        return "appearance-none pl-3 pr-7 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer bg-[#111] border border-white/5 hover:border-white/10 text-white shadow-inner";
    }
  };

  const renderPriorityDot = (val) => {
    if (val === 'High') return <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>;
    if (val === 'Medium') return <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"></div>;
    return <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>;
  };

  return (
    <div className={`relative ${className}`}>
      <Listbox value={value} onChange={onChange}>
        {({ open }) => (
          <>
            <Listbox.Button className={`relative flex items-center ${getButtonStyles()} w-full`}>
              {variant === 'priority' && (
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                  {renderPriorityDot(value)}
                </div>
              )}
              <span className="block truncate">{value}</span>
              <span className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 ${variant === 'form' ? 'pr-4' : ''}`}>
                <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
              </span>
            </Listbox.Button>
            
            <AnimatePresence>
              {open && (
                <Listbox.Options
                  static
                  as={motion.ul}
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                  className={`absolute z-50 mt-1 max-h-60 w-max min-w-full overflow-auto rounded-md bg-[#0A0A0A]/95 p-1 text-sm shadow-2xl border border-white/5 backdrop-blur-md focus:outline-none ${variant === 'form' ? 'text-sm' : 'text-xs'}`}
                >
                  {options.map((option) => (
                    <Listbox.Option
                      key={option.value || option}
                      value={option.value || option}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-8 pr-4 rounded-sm transition-colors ${
                          active ? 'bg-white/10 text-white' : 'text-brand-100/70'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <div className="flex items-center">
                            {variant === 'priority' && (
                              <div className="mr-2">
                                {renderPriorityDot(option.value || option)}
                              </div>
                            )}
                            <span className={`block truncate ${selected ? 'font-medium text-brand-400' : 'font-normal'}`}>
                              {option.label || option}
                            </span>
                          </div>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-brand-400">
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                          ) : null}
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
