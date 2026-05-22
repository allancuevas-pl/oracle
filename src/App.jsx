import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Briefs } from './pages/Briefs';
import { BriefView } from './pages/BriefView';
import { Toaster } from 'sonner';

import { Properties } from './pages/Properties';
import { PropertyView } from './pages/PropertyView';
import { Pipeline } from './pages/Pipeline';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';

function RoleGuard({ children }) {
  const user = useQuery(api.users.getCurrentUser);
  const storeUser = useMutation(api.users.storeUser);

  useEffect(() => {
    // Only try to store if the query returned null or undefined, 
    // or just run it blindly (mutation checks internally)
    storeUser().catch(() => {});
  }, [storeUser]);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
        <p className="text-brand-100/50 text-sm">Verifying access...</p>
      </div>
    );
  }

  if (user === null || user.role === 'client') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500/80 mb-4" />
        <h1 className="text-2xl font-semibold text-brand-50 mb-2">Access Denied</h1>
        <p className="text-brand-100/70 max-w-md">
          You do not have permission to view the Oracle CRM. The Client Portal is currently under construction.
        </p>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <>
      <SignedOut>
        <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4">
          <div className="mb-8 flex items-center justify-center">
            <div className="w-12 h-12 rounded bg-brand-500/20 flex items-center justify-center border border-brand-500/50">
              <div className="w-6 h-6 border-2 border-brand-500 transform rotate-45"></div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-wide text-brand-50 mb-8">ORACLE</h1>
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      
      <SignedIn>
        <Toaster 
          theme="dark" 
          toastOptions={{
            style: {
              background: '#0A0A0A',
              border: '1px solid rgba(212, 175, 55, 0.2)',
              color: '#F9F9F9',
            }
          }} 
        />
        <RoleGuard>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/briefs" element={<Briefs />} />
                <Route path="/briefs/:id" element={<BriefView />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyView />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/tasks" element={<div className="p-4 text-brand-400">Tasks View (Mock)</div>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </RoleGuard>
      </SignedIn>
    </>
  );
}

export default App;
