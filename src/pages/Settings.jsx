import React, { useState } from 'react';
import { MapPin, Eye, EyeOff, Check, AlertCircle, ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getGoogleMapsKey, setGoogleMapsKey } from '../hooks/useGoogleMaps';

function ApiKeyCard({ title, icon: Icon, description, docsUrl, placeholder }) {
  const [currentKey, setCurrentKey] = useState(getGoogleMapsKey);
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);

  const maskedKey = currentKey
    ? `${currentKey.slice(0, 6)}${'•'.repeat(Math.max(0, currentKey.length - 10))}${currentKey.slice(-4)}`
    : '';

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setGoogleMapsKey(trimmed);
    setCurrentKey(trimmed);
    setInput('');
    toast.success('API key saved', {
      description: 'Address autocomplete is now active.',
      duration: 3000,
    });
  };

  const handleRemove = () => {
    setGoogleMapsKey('');
    setCurrentKey('');
    setInput('');
    setShow(false);
    toast.info('API key removed', { duration: 2500 });
  };

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Card header */}
      <div className="bg-[#0D0D0D] px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-brand-500" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500">
            {title}
          </p>
        </div>
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-brand-100/30 hover:text-brand-100/60 transition-colors"
          >
            Docs
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-brand-100/45 leading-relaxed">{description}</p>

        {/* Current key status */}
        {currentKey ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/20">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <p className="text-xs text-brand-100/60 flex-1 font-mono truncate">
              {show ? currentKey : maskedKey}
            </p>
            <button
              onClick={() => setShow((v) => !v)}
              className="text-brand-100/25 hover:text-brand-100/60 transition-colors shrink-0"
              aria-label={show ? 'Hide key' : 'Reveal key'}
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleRemove}
              className="text-brand-100/20 hover:text-red-400 transition-colors shrink-0"
              aria-label="Remove key"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <AlertCircle className="w-3.5 h-3.5 text-brand-100/20 shrink-0" />
            <p className="text-xs text-brand-100/30">Not configured — feature is disabled.</p>
          </div>
        )}

        {/* Paste + save row */}
        <div>
          <div className="flex gap-2">
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={placeholder || 'Paste your API key…'}
              className="flex-1 bg-[#111] border border-brand-800/40 rounded-md px-3 py-2 text-xs text-brand-50 placeholder:text-brand-100/20 font-mono focus:border-brand-500/50 focus:outline-none transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={handleSave}
              disabled={!input.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-brand-950 bg-brand-500 hover:bg-brand-400 disabled:opacity-25 disabled:cursor-not-allowed rounded-md transition-all whitespace-nowrap"
            >
              Save Key
            </button>
          </div>
          <p className="text-[10px] text-brand-100/20 mt-2.5">
            Stored in your browser only — never sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  return (
    <div className="max-w-2xl mx-auto px-6 lg:px-8 py-10">

      {/* Page header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-500 mb-2">
          Configuration
        </p>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-brand-100/40 mt-1">
          Manage workspace configuration and third-party integrations.
        </p>
      </div>

      {/* Integrations section */}
      <section className="space-y-4">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-brand-100/30" />
            <h2 className="text-sm font-semibold text-brand-50">Integrations</h2>
          </div>
          <p className="text-xs text-brand-100/35 ml-6">
            API keys for external services. Stored locally in this browser — not synced across devices.
          </p>
        </div>

        <ApiKeyCard
          title="Google Maps API"
          icon={MapPin}
          description="Enables address autocomplete when adding or editing properties. Requires a Google Maps Platform API key with the Places API enabled and an authorised domain."
          docsUrl="https://developers.google.com/maps/documentation/places/web-service/get-api-key"
          placeholder="AIzaSy…"
        />
      </section>

    </div>
  );
}
