import React from 'react';
import { LayoutDashboard, FileText, Building2, Layers, Users, Settings, LogOut, ScanSearch } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Clients', path: '/clients' },
  { icon: FileText, label: 'Client Briefs', path: '/briefs' },
  { icon: Building2, label: 'Properties', path: '/properties' },
  { icon: Layers, label: 'Pipeline', path: '/pipeline' },
  { icon: ScanSearch, label: 'Oracle', path: '/oracle' },
];

export function Sidebar() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = () => signOut(() => navigate('/'));

  return (
    <div className="w-64 bg-[#0A0A0A] border-r border-brand-800/50 flex flex-col h-full">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-brand-800/50 shrink-0">
        <div className="w-6 h-6 rounded bg-brand-500/20 flex items-center justify-center border border-brand-500/50 mr-3">
          <div className="w-3 h-3 border border-brand-500 transform rotate-45"></div>
        </div>
        <span className="text-lg font-semibold tracking-wide text-brand-50">ORACLE</span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-brand-500/10 text-brand-400' 
                  : 'text-brand-100/70 hover:bg-brand-900/30 hover:text-brand-100'
              }`
            }
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer Area */}
      <div className="p-4 border-t border-brand-800/50">
        <div className="flex items-center space-x-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-brand-800 flex items-center justify-center text-xs font-medium">
            WT
          </div>
          <div>
            <p className="text-sm font-medium text-brand-50">Will Tong</p>
            <p className="text-xs text-brand-400">Director</p>
          </div>
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? 'bg-brand-500/10 text-brand-400'
                : 'text-brand-100/70 hover:text-white hover:bg-brand-900/30'
            }`
          }
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </NavLink>
        <button
          onClick={handleSignOut}
          className="flex items-center px-3 py-2 mt-1 text-sm font-medium text-brand-100/70 hover:text-white w-full rounded-md hover:bg-brand-900/30 transition-colors"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
