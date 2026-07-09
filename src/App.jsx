import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { AppLayout } from './components/layout/AppLayout';
import { ClientLayout } from './components/layout/ClientLayout';
import { Toaster } from 'sonner';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { ShieldAlert } from 'lucide-react';
import { Spinner, PageLoader } from './components/ui/Loading';

// Route-level pages are code-split: each becomes its own chunk and only loads
// when its route is visited, keeping the initial bundle small. Named exports
// are mapped to a default for React.lazy.
const named = (p, name) => lazy(() => p().then(m => ({ default: m[name] })));
const Dashboard      = named(() => import('./pages/Dashboard'), 'Dashboard');
const Briefs         = named(() => import('./pages/Briefs'), 'Briefs');
const BriefView      = named(() => import('./pages/BriefView'), 'BriefView');
const Properties     = named(() => import('./pages/Properties'), 'Properties');
const PropertyView   = named(() => import('./pages/PropertyView'), 'PropertyView');
const Pipeline       = named(() => import('./pages/Pipeline'), 'Pipeline');
const Clients        = named(() => import('./pages/Clients'), 'Clients');
const ClientView     = named(() => import('./pages/ClientView'), 'ClientView');
const Settings       = named(() => import('./pages/Settings'), 'Settings');
const OracleScanner  = named(() => import('./pages/OracleScanner'), 'OracleScanner');
const Comps          = named(() => import('./pages/Comps'), 'Comps');
const ReportView     = named(() => import('./pages/ReportView'), 'ReportView');
const ClientDashboard = named(() => import('./pages/client/ClientDashboard'), 'ClientDashboard');
const ClientDealView  = named(() => import('./pages/client/ClientDealView'), 'ClientDealView');
const ClientPortalLogin = named(() => import('./pages/client/ClientPortalLogin'), 'ClientPortalLogin');

function RoleGuard({ children }) {
  const user = useQuery(api.users.getCurrentUser);
  const storeUser = useMutation(api.users.storeUser);

  useEffect(() => {
    storeUser().catch(() => {});
  }, [storeUser]);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center">
        <Spinner className="w-7 h-7 mb-4" />
        <p className="text-brand-100/50 text-sm">Verifying access...</p>
      </div>
    );
  }

  // Client role — redirect to their own portal instead of blocking
  if (user?.role === 'client') {
    return <Navigate to="/client/dashboard" replace />;
  }

  // No record, or blocked (signed up without invite) — access denied
  if (!user || user.role === 'blocked') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500/80 mb-4" />
        <h1 className="text-2xl font-semibold text-brand-50 mb-2">Access Denied</h1>
        <p className="text-brand-100/70 max-w-md">
          Your account hasn't been granted access. Contact your Property Lions team.
        </p>
      </div>
    );
  }

  return children;
}

/** Wrapper for client portal routes — blocks unauthenticated and non-client users */
function ClientPortalLayout() {
  const user = useQuery(api.users.getCurrentUser);

  return (
    <>
      <SignedOut><Navigate to="/portal" replace /></SignedOut>
      <SignedIn>
        {user === undefined ? (
          <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
            <Spinner className="w-7 h-7" />
          </div>
        ) : !user || user.role === 'blocked' || user.role === 'staff' || user.role === 'admin' ? (
          <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500/80 mb-4" />
            <h1 className="text-2xl font-semibold text-brand-50 mb-2">Access Denied</h1>
            <p className="text-brand-100/70 max-w-md">This portal is for clients only.</p>
          </div>
        ) : (
          <ClientLayout />
        )}
      </SignedIn>
    </>
  );
}

/**
 * Client portal login route (/portal) — the Property Lions-branded client
 * sign-in. Signed-out visitors see the branded login; already-signed-in users
 * are sent to their dashboard. Kept separate from the staff ORACLE <SignIn>
 * because the client's role isn't known until after auth.
 */
function ClientPortalEntry() {
  return (
    <>
      <SignedIn><Navigate to="/client/dashboard" replace /></SignedIn>
      <SignedOut><ClientPortalLogin /></SignedOut>
    </>
  );
}

/** The full CRM — Clerk-gated, staff/admin only. */
function CRMApp() {
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ClientView />} />
                <Route path="/briefs" element={<Briefs />} />
                <Route path="/briefs/:id" element={<BriefView />} />
                <Route path="/properties" element={<Properties />} />
                <Route path="/properties/:id" element={<PropertyView />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/oracle" element={<OracleScanner />} />
                <Route path="/comps" element={<Comps />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/tasks" element={<div className="p-4 text-brand-400">Tasks View (Mock)</div>} />
              </Route>
            </Routes>
          </Suspense>
        </RoleGuard>
      </SignedIn>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-brand-black"><PageLoader /></div>}>
        <Routes>
          {/* Public — token-gated, no Clerk auth required */}
          <Route path="/report/:token" element={<ReportView />} />

          {/* Client portal login — branded, signed-out client sign-in */}
          <Route path="/portal" element={<ClientPortalEntry />} />

          {/* Client portal — Clerk-gated, no CRM staff/admin check */}
          <Route path="/client" element={<ClientPortalLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="deal/:token" element={<ClientDealView />} />
          </Route>

          {/* All other routes — Clerk + staff/admin RoleGuard */}
          <Route path="*" element={<CRMApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
