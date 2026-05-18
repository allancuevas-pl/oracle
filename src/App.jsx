import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Briefs } from './pages/Briefs';
import { BriefView } from './pages/BriefView';

import { Properties } from './pages/Properties';
import { PropertyView } from './pages/PropertyView';

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
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/briefs" element={<Briefs />} />
              <Route path="/briefs/:id" element={<BriefView />} />
              <Route path="/properties" element={<Properties />} />
              <Route path="/properties/:id" element={<PropertyView />} />
              <Route path="/tasks" element={<div className="p-4 text-brand-400">Tasks View (Mock)</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SignedIn>
    </>
  );
}

export default App;
