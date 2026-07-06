import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { LogOut } from 'lucide-react';

export function ClientLayout() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();

  const handleSignOut = () => signOut(() => navigate('/'));

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-[#050505] text-brand-50 flex flex-col">

      {/* Top nav */}
      <header className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#050505]/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
            <div className="w-3.5 h-3.5 border-[1.5px] border-brand-500 rotate-45" />
          </div>
          <span className="text-sm font-semibold tracking-wider text-brand-50">PROPERTY LIONS</span>
          <span className="text-brand-100/40 text-xs font-light ml-1">· Client Portal</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-800/60 border border-brand-700/40 flex items-center justify-center text-[10px] font-bold text-brand-400">
              {initials}
            </div>
            <span className="text-sm text-brand-100/60 hidden sm:block">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-brand-100/40 hover:text-brand-100/80 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

    </div>
  );
}
