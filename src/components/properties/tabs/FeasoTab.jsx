import React from 'react';
import { Calculator, ArrowRight } from 'lucide-react';

export function FeasoTab() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] max-w-lg mx-auto text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-900/40 border border-brand-800/50 flex items-center justify-center mb-5">
        <Calculator className="w-7 h-7 text-brand-500/60" />
      </div>
      <h3 className="text-lg font-semibold text-brand-50 mb-2">Feasibility Analysis</h3>
      <p className="text-sm text-brand-100/50 leading-relaxed mb-6 max-w-sm">
        Full feasibility modelling — IRR, equity multiples, project margin, hold-period analysis, and
        debt-stack structuring — will connect here through the Feaso tool.
      </p>
      <div className="flex items-center gap-2 text-xs text-brand-100/30">
        <span className="px-2.5 py-1 rounded-full border border-white/[0.06] bg-white/[0.02]">
          Phase 3
        </span>
        <ArrowRight className="w-3.5 h-3.5" />
        <span>Feaso integration</span>
      </div>
    </div>
  );
}
