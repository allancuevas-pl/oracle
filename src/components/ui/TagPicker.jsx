import React from 'react';

/**
 * Reusable multi-select tag toggle.
 * Renders a row of pill buttons; selected ones are highlighted gold.
 *
 * Props:
 *   label    — section label (string)
 *   tags     — array of string options
 *   selected — array of currently-selected tags
 *   onToggle — (tag: string) => void
 */
export function TagPicker({ label, tags, selected, onToggle }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-brand-100/70 mb-2">{label}</label>
      )}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selected.includes(tag)
                ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                : 'bg-[#0A0A0A] border-brand-800/50 text-brand-100/60 hover:border-brand-500/30'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
