import React from 'react';
import { Bell, Search } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 bg-[#0A0A0A]/95 backdrop-blur border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center flex-1">
        <div className="relative w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-100/50" />
          <input 
            type="text" 
            placeholder="Search properties, clients, or briefs..." 
            className="w-full bg-[#111] border border-white/5 rounded-md py-1.5 pl-9 pr-4 text-sm text-brand-50 placeholder:text-brand-100/45 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all shadow-inner"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="relative p-2 rounded-full hover:bg-brand-900/30 text-brand-100/70 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full"></span>
        </button>
        <button className="bg-brand-500 hover:bg-brand-400 text-brand-950 px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]">
          + New Brief
        </button>
      </div>
    </header>
  );
}
