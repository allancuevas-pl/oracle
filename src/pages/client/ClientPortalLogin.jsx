import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn } from '@clerk/clerk-react';

/**
 * Property Lions — Client Portal Login.
 * High-fidelity build of the design handoff (design_handoff_client_portal_login):
 * ceremonial single-column, navy field, gold accents, Marcellus title + Jost body.
 *
 * Auth: custom flow via Clerk `useSignIn()` (email + password). This screen is the
 * returning-client sign-in; first-time invitees accept via Clerk's hosted invitation
 * flow. Password sign-in must be ENABLED in the Clerk instance for this to
 * authenticate — otherwise `signIn.create` returns a strategy error (shown inline).
 * "Forgot password" runs Clerk's reset_password_email_code flow.
 */

// Design tokens (client-login palette — intentionally distinct from the CRM brand).
const C = {
  navy: '#0A1220',
  ivory: '#F4EFE4',
  gold: '#D9A82E',
  goldHover: '#E7BC49',
  muted: 'rgba(244,239,228,0.55)',
  faint: 'rgba(244,239,228,0.35)',
};

const SUPPORT_EMAIL = 'hello@propertylions.com.au';
const SUPPORT_PHONE = '1300 399 933';
// Optional SSO button — feature-flagged off per the design (no SSO configured yet).
const SHOW_SSO = false;

const scopedCss = `
.pl-login, .pl-login input, .pl-login button { font-family: 'Jost', system-ui, sans-serif; }
.pl-login input::placeholder { color: rgba(244,239,228,0.35); }
.pl-login input:focus { border-color: ${C.gold} !important; }
.pl-login .pl-primary:hover:not(:disabled) { background: ${C.goldHover}; }
.pl-login .pl-primary:disabled { opacity: 0.55; cursor: default; }
.pl-login .pl-sso:hover { border-color: rgba(244,239,228,0.6); }
.pl-login .pl-link:hover { color: ${C.gold}; }
`;

const labelStyle = {
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: 'rgba(244,239,228,0.5)',
};
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(217,168,46,0.25)',
  borderRadius: 2,
  padding: '14px 16px',
  fontSize: 15,
  color: C.ivory,
  outline: 'none',
};

function Field({ label, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} {...props} />
    </div>
  );
}

export function ClientPortalLogin() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signIn'); // 'signIn' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStage, setResetStage] = useState('request'); // 'request' | 'verify'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clerkError = (err) =>
    err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Something went wrong. Please try again.';

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true); setError('');
    try {
      const res = await signIn.create({ identifier: email.trim(), password });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        navigate('/client/dashboard', { replace: true });
      } else {
        // e.g. needs a second factor — not part of this portal's flow.
        setError('Additional verification is required. Please contact your Property Lions team.');
      }
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
      setResetStage('verify');
      setNotice(`We sent a reset code to ${email.trim()}.`);
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResetVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded || busy) return;
    setBusy(true); setError('');
    try {
      const res = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password: newPassword,
      });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        navigate('/client/dashboard', { replace: true });
      } else {
        setError('Could not complete the reset. Please try again.');
      }
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const goReset = () => {
    setMode('reset'); setResetStage('request');
    setError(''); setNotice(''); setPassword('');
  };
  const goSignIn = () => {
    setMode('signIn'); setError(''); setNotice('');
    setCode(''); setNewPassword('');
  };

  const title = mode === 'reset' ? 'Reset Access' : 'Client Portal';

  return (
    <div
      className="pl-login"
      style={{
        minHeight: '100vh', background: C.navy, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}
    >
      <style>{scopedCss}</style>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: 400, maxWidth: '100%', padding: '60px 24px' }}>
        <img src="/property-lions-logo.png" alt="Property Lions" style={{ width: 180, display: 'block' }} />
        <div style={{ width: 44, height: 1, background: C.gold, margin: '30px 0 26px' }} />
        <div style={{ fontFamily: "'Marcellus', serif", fontSize: 26, color: C.ivory, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {title}
        </div>

        {/* ── Sign in ─────────────────────────────────────────────── */}
        {mode === 'signIn' && (
          <>
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', marginTop: 44 }}>
              <Field label="Email" type="email" autoComplete="email" placeholder="you@company.com.au"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Field label="Password" type="password" autoComplete="current-password" placeholder="••••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required />

              {error && <p style={{ margin: 0, fontSize: 13, color: '#E08A7A' }}>{error}</p>}

              <button type="submit" className="pl-primary" disabled={busy || !isLoaded}
                style={{ marginTop: 10, background: C.gold, border: 'none', borderRadius: 2, padding: '15px 0', fontSize: 13, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.navy, cursor: 'pointer', transition: 'background 150ms ease' }}>
                {busy ? 'Signing in…' : 'Enter the Portal'}
              </button>

              {SHOW_SSO && (
                <button type="button" className="pl-sso"
                  style={{ background: 'transparent', border: '1px solid rgba(244,239,228,0.25)', borderRadius: 2, padding: '13px 0', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(244,239,228,0.8)', cursor: 'pointer', transition: 'border-color 150ms ease' }}>
                  Single Sign-On
                </button>
              )}
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 22, fontSize: 13, fontWeight: 300 }}>
              <button type="button" className="pl-link" onClick={goReset}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.muted, transition: 'color 150ms ease' }}>
                Forgot password
              </button>
              <a className="pl-link" href={`mailto:${SUPPORT_EMAIL}?subject=Portal%20access%20request`}
                style={{ color: C.muted, textDecoration: 'none', transition: 'color 150ms ease' }}>
                Request access
              </a>
            </div>
          </>
        )}

        {/* ── Reset password ──────────────────────────────────────── */}
        {mode === 'reset' && (
          <>
            <form onSubmit={resetStage === 'request' ? handleResetRequest : handleResetVerify}
              style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', marginTop: 44 }}>
              {resetStage === 'request' ? (
                <Field label="Email" type="email" autoComplete="email" placeholder="you@company.com.au"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              ) : (
                <>
                  <Field label="Reset code" inputMode="numeric" placeholder="6-digit code"
                    value={code} onChange={(e) => setCode(e.target.value)} required />
                  <Field label="New password" type="password" autoComplete="new-password" placeholder="••••••••••"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </>
              )}

              {notice && <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{notice}</p>}
              {error && <p style={{ margin: 0, fontSize: 13, color: '#E08A7A' }}>{error}</p>}

              <button type="submit" className="pl-primary" disabled={busy || !isLoaded}
                style={{ marginTop: 10, background: C.gold, border: 'none', borderRadius: 2, padding: '15px 0', fontSize: 13, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.navy, cursor: 'pointer', transition: 'background 150ms ease' }}>
                {busy ? 'Please wait…' : resetStage === 'request' ? 'Send Reset Code' : 'Set New Password'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 22, fontSize: 13, fontWeight: 300 }}>
              <button type="button" className="pl-link" onClick={goSignIn}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.muted, transition: 'color 150ms ease' }}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', fontSize: 12, fontWeight: 300, color: C.faint, letterSpacing: '0.06em' }}>
        {SUPPORT_EMAIL}&nbsp;&nbsp;·&nbsp;&nbsp;{SUPPORT_PHONE}
      </div>
    </div>
  );
}
