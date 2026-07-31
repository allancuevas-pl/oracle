import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';

/**
 * Property Lions — Client Portal Login.
 * High-fidelity build of the design handoff (design_handoff_client_portal_login):
 * ceremonial single-column, navy field, gold accents, Marcellus title + Jost body.
 *
 * Auth modes:
 *  - 'signIn' — returning client, email + password (or Google). Password sign-in
 *    must be ENABLED in the Clerk instance or `signIn.create` returns a strategy error.
 *  - 'reset'  — Clerk reset_password_email_code flow ("Forgot password").
 *  - 'accept' — FIRST-TIME invitee. Clerk invitation emails redirect here with a
 *    `__clerk_ticket` query param; we consume it via `useSignUp()` and prompt the
 *    invitee to set their password (there is no other way for them to get one).
 *    Without this, an invited client hits "can't find account" (no credential exists).
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
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const navigate = useNavigate();

  // Invitation ticket — present when the invitee arrives from a Clerk invite email.
  const inviteTicket = new URLSearchParams(window.location.search).get('__clerk_ticket');

  const [mode, setMode] = useState(inviteTicket ? 'accept' : 'signIn'); // 'signIn' | 'reset' | 'accept'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStage, setResetStage] = useState('request'); // 'request' | 'verify'
  const [inviteEmail, setInviteEmail] = useState(''); // locked email from the invitation
  const [acceptReady, setAcceptReady] = useState(false); // ticket consumed, ready for password
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clerkError = (err) =>
    err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Something went wrong. Please try again.';

  // First-time invitation: Clerk redirects the invite link here with a
  // `__clerk_ticket` (and `__clerk_status`). Consume it so the invitee can set a
  // password. `sign_in` status = the email already has an account (e.g. created
  // via Google) — complete it directly, no password step needed.
  useEffect(() => {
    if (!isLoaded || !signUpLoaded || !inviteTicket) return;
    const status = new URLSearchParams(window.location.search).get('__clerk_status');
    (async () => {
      try {
        if (status === 'sign_in') {
          const res = await signIn.create({ strategy: 'ticket', ticket: inviteTicket });
          if (res.status === 'complete') {
            await setActive({ session: res.createdSessionId });
            navigate('/client/dashboard', { replace: true });
          }
          return;
        }
        const res = await signUp.create({ strategy: 'ticket', ticket: inviteTicket });
        setInviteEmail(res.emailAddress || '');
        if (res.status === 'complete') {
          await setActive({ session: res.createdSessionId });
          navigate('/client/dashboard', { replace: true });
        } else {
          setAcceptReady(true); // awaiting password
        }
      } catch (err) {
        // Invalid/expired ticket — show the error, not a dead password form.
        setError(clerkError(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, signUpLoaded]);

  // Google OAuth — Clerk redirects out, returns to /sso-callback which completes
  // the handshake, then routing sends the user to the right place by role.
  const handleGoogle = async () => {
    if (!isLoaded || busy) return;
    setBusy(true); setError('');
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/`,
      });
    } catch (err) {
      setError(clerkError(err));
      setBusy(false);
    }
  };

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

  // First-time invitee sets their password on the already-consumed ticket.
  const handleAcceptSetPassword = async (e) => {
    e.preventDefault();
    if (!signUpLoaded || busy) return;
    setBusy(true); setError('');
    try {
      const res = await signUp.update({ password: newPassword });
      if (res.status === 'complete') {
        await setActive({ session: res.createdSessionId });
        navigate('/client/dashboard', { replace: true });
      } else {
        setError('Could not complete setup. Please contact your Property Lions team.');
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

  const title = mode === 'reset' ? 'Reset Access' : mode === 'accept' ? 'Set Your Password' : 'Client Portal';

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

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(244,239,228,0.12)' }} />
                <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(244,239,228,0.35)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(244,239,228,0.12)' }} />
              </div>

              {/* Google OAuth — works for accounts created via Google */}
              <button type="button" className="pl-sso" onClick={handleGoogle} disabled={busy || !isLoaded}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'transparent', border: '1px solid rgba(244,239,228,0.25)', borderRadius: 2, padding: '13px 0', fontSize: 13, letterSpacing: '0.04em', color: 'rgba(244,239,228,0.85)', cursor: 'pointer', transition: 'border-color 150ms ease' }}>
                <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
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

        {/* ── First-time invitation: set password ─────────────────── */}
        {mode === 'accept' && (
          <>
            {acceptReady ? (
              <>
                <p style={{ marginTop: 40, marginBottom: 0, fontSize: 14, lineHeight: 1.6, color: C.muted, textAlign: 'center' }}>
                  Welcome to Property Lions.{' '}
                  {inviteEmail
                    ? <>Create a password for <span style={{ color: C.ivory }}>{inviteEmail}</span> to enter your portal.</>
                    : 'Create a password to enter your portal.'}
                </p>
                <form onSubmit={handleAcceptSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', marginTop: 28 }}>
                  <Field label="New password" type="password" autoComplete="new-password" placeholder="••••••••••"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
                  {/* Clerk mounts its bot-protection (Smart CAPTCHA) here for the
                      sign-up; without this element it warns and falls back to invisible. */}
                  <div id="clerk-captcha" />
                  {error && <p style={{ margin: 0, fontSize: 13, color: '#E08A7A' }}>{error}</p>}
                  <button type="submit" className="pl-primary" disabled={busy || !signUpLoaded}
                    style={{ marginTop: 10, background: C.gold, border: 'none', borderRadius: 2, padding: '15px 0', fontSize: 13, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.navy, cursor: 'pointer', transition: 'background 150ms ease' }}>
                    {busy ? 'Setting up…' : 'Create Password & Enter'}
                  </button>
                </form>
              </>
            ) : error ? (
              <>
                <p style={{ marginTop: 40, fontSize: 14, lineHeight: 1.6, color: '#E08A7A', textAlign: 'center' }}>{error}</p>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, textAlign: 'center' }}>
                  Your invitation link may have expired. Please contact your Property Lions team for a new one.
                </p>
                <button type="button" className="pl-link" onClick={goSignIn}
                  style={{ marginTop: 22, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.muted, transition: 'color 150ms ease', fontSize: 13 }}>
                  Back to sign in
                </button>
              </>
            ) : (
              <p style={{ marginTop: 44, fontSize: 14, color: C.muted }}>Preparing your invitation…</p>
            )}
          </>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, textAlign: 'center', fontSize: 12, fontWeight: 300, color: C.faint, letterSpacing: '0.06em' }}>
        {SUPPORT_EMAIL}&nbsp;&nbsp;·&nbsp;&nbsp;{SUPPORT_PHONE}
      </div>
    </div>
  );
}
