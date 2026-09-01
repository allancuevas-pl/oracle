import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable multi-select tag toggle.
 * Renders a row of pill buttons; selected ones are highlighted gold.
 *
 * Props:
 *   label      — section label (string)
 *   tags       — array of string options
 *   selected   — array of currently-selected tags
 *   onToggle   — (tag: string) => void
 *   allowOther — when true, offers "+ Other" to add a free-text value
 *
 * `allowOther` exists because Will asked for it on asset types and strategies
 * (Loom, 27 Aug): the fixed lists don't cover childcare, medical, development
 * sites and so on. A custom value is just another string in `selected`, so no
 * schema change is needed — the caller can't tell the difference. Anything in
 * `selected` that isn't in `tags` renders as a removable custom pill.
 */
export function TagPicker({ label, tags, selected, onToggle, allowOther = false }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const custom = allowOther ? selected.filter((s) => !tags.includes(s)) : [];

  const commit = () => {
    const value = draft.trim();
    // Ignore blanks and anything already present, in either list.
    if (value && !selected.includes(value) && !tags.includes(value)) onToggle(value);
    setDraft('');
    setAdding(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setDraft(''); setAdding(false); }
  };

  const pill = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors';
  const on   = 'bg-brand-500/20 border-brand-500/50 text-brand-400';
  const off  = 'bg-[#0A0A0A] border-brand-800/50 text-brand-100/60 hover:border-brand-500/30';

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
            className={`${pill} ${selected.includes(tag) ? on : off}`}
          >
            {tag}
          </button>
        ))}

        {custom.map((tag) => (
          <span key={tag} className={`${pill} ${on} inline-flex items-center gap-1.5`}>
            {tag}
            <button
              type="button"
              onClick={() => onToggle(tag)}
              aria-label={`Remove ${tag}`}
              className="text-brand-400/60 hover:text-brand-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {allowOther && (adding ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commit}
            placeholder="Type and press Enter"
            className="px-3 py-1.5 w-48 rounded-full text-xs bg-[#0A0A0A] border border-brand-500/50 text-brand-50 placeholder:text-brand-100/35 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`${pill} ${off} border-dashed`}
          >
            + Other
          </button>
        ))}
      </div>
    </div>
  );
}
