/**
 * Login.jsx — TAS Tracking Application
 * ======================================
 * Authentication page with role-based login.
 * Handles email/password validation, forgot-password modal, reCAPTCHA, and route to appropriate dashboard.
 */

import { useState } from 'react';
import db from '../utils/mockDb';
import ReCaptcha from '../components/ReCaptcha';

export default function Login({ onLogin, onBack }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent]         = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaKey, setCaptchaKey]           = useState(0);
  const [showCaptchaWarn, setShowCaptchaWarn] = useState(false);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Handle login form submission */
  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }

    // reCAPTCHA gate
    if (!captchaVerified) {
      setShowCaptchaWarn(true);
      return;
    }

    setLoading(true);
    setShowCaptchaWarn(false);

    // Simulate async API call delay
    setTimeout(() => {
      const user = db.authenticate(email.trim(), password);
      setLoading(false);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid email or password. Please try again.');
        // Reset reCAPTCHA on failed attempt
        setCaptchaVerified(false);
        setCaptchaKey((k) => k + 1);
      }
    }, 700);
  };

  /** Handle forgot password submission (mocked) */
  const handleForgot = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setTimeout(() => setForgotSent(true), 500);
  };

  /** Quick-fill demo credentials */
  const fillCredentials = (role) => {
    if (role === 'admin') {
      setEmail('admin@tas.com');
      setPassword('admin123');
    } else {
      setEmail('user@tas.com');
      setPassword('user123');
    }
    setError('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="app-bg" />

      {/* Grid overlay */}
      <div className="login-grid-overlay" />

      {/* Login card container */}
      <div className="login-wrapper">

        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 8h20M4 14h12M4 20h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="22" cy="20" r="4" fill="none" stroke="#06b6d4" strokeWidth="2"/>
            </svg>
          </div>
          <div>
            <div className="login-brand-name">TAS</div>
            <div className="login-brand-sub">Track &amp; Ship</div>
          </div>
        </div>

        {/* Card */}
        <div className="login-card glass-card">
          <div className="login-card-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in to access the TAS tracking portal</p>
          </div>

          {/* Demo credential hints */}
          <div className="login-demo-badges">
            <button
              type="button"
              className="demo-badge demo-badge--admin"
              onClick={() => fillCredentials('admin')}
              title="Fill admin credentials"
            >
              <span>🛡️</span> Admin Demo
            </button>
            <button
              type="button"
              className="demo-badge demo-badge--user"
              onClick={() => fillCredentials('user')}
              title="Fill user credentials"
            >
              <span>👤</span> User Demo
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="login-form" noValidate>
            {/* Email */}
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <div className="input-icon-wrap">
                <span className="input-icon">✉️</span>
                <input
                  id="login-email"
                  type="email"
                  className="form-input form-input--with-icon"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Password</label>
              <div className="input-icon-wrap">
                <span className="input-icon">🔒</span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input form-input--with-icon form-input--with-icon-right"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="login-error">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Forgot password */}
            <div className="login-forgot">
              <button
                type="button"
                className="link-btn"
                onClick={() => { setShowForgot(true); setForgotSent(false); setForgotEmail(''); }}
              >
                Forgot password?
              </button>
            </div>

            {/* reCAPTCHA */}
            <div>
              <ReCaptcha
                key={captchaKey}
                onVerify={(token) => { setCaptchaVerified(!!token); if (token) setShowCaptchaWarn(false); }}
                theme="dark"
              />
              {showCaptchaWarn && (
                <div className="login-error" style={{ marginTop: '0.5rem' }}>
                  <span>⚠️</span> Please complete the reCAPTCHA verification.
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className={`btn btn--primary btn--full btn--lg ${loading ? 'btn--loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Signing in…
                </>
              ) : (
                <>
                  <span>→</span> Sign In
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="login-security-note">
            <span>🔐</span>
            <span>256-bit SSL encrypted · Role-based access control · SOC 2 compliant</span>
          </div>
        </div>

        {/* Back to public + footer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          {onBack && (
            <button
              type="button"
              className="link-btn"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              onClick={onBack}
            >
              ← Back to Public Tracking
            </button>
          )}
          <p className="login-footer">
            © 2026 TAS Track &amp; Ship. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Forgot Password Modal ───────────────────────────────────────────── */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {!forgotSent ? (
              <>
                <div className="modal-icon">📧</div>
                <h2 className="modal-title">Reset Password</h2>
                <p className="text-secondary text-sm mb-6">
                  Enter your email address and we'll send you a secure reset link.
                </p>
                <form onSubmit={handleForgot}>
                  <div className="form-group mb-4">
                    <input
                      type="email"
                      className="form-input"
                      placeholder="your@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
                      Send Reset Link
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setShowForgot(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <h2 className="modal-title">Check your inbox</h2>
                <p className="text-secondary text-sm mb-6">
                  A password reset link has been sent to <strong>{forgotEmail}</strong>.
                  Check your spam folder if you don't see it.
                </p>
                <button className="btn btn--primary btn--full" onClick={() => setShowForgot(false)}>
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Login-specific styles ──────────────────────────────────────────── */}
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          position: relative;
          overflow: hidden;
        }

        .login-grid-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(99,162,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,162,255,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          z-index: 0;
        }

        .login-wrapper {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .login-logo {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #2563eb, #06b6d4);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 30px rgba(37, 99, 235, 0.4);
        }

        .login-brand-name {
          font-size: 2rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          background: linear-gradient(90deg, #f0f6ff, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .login-brand-sub {
          font-size: 0.75rem;
          color: #4a5a72;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 500;
        }

        .login-card {
          width: 100%;
          padding: 2.5rem;
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .login-title {
          font-size: 1.625rem;
          font-weight: 800;
          color: #f0f6ff;
          margin-bottom: 0.375rem;
        }

        .login-subtitle {
          font-size: 0.875rem;
          color: #64748b;
        }

        .login-demo-badges {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .demo-badge {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          transition: all 200ms ease;
          font-family: inherit;
        }

        .demo-badge--admin {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
        }

        .demo-badge--admin:hover {
          background: rgba(99, 102, 241, 0.22);
          transform: translateY(-1px);
        }

        .demo-badge--user {
          background: rgba(6, 182, 212, 0.1);
          border-color: rgba(6, 182, 212, 0.3);
          color: #67e8f9;
        }

        .demo-badge--user:hover {
          background: rgba(6, 182, 212, 0.2);
          transform: translateY(-1px);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .input-icon-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1rem;
          pointer-events: none;
          z-index: 1;
        }

        .input-icon-right {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          padding: 4px;
          border-radius: 4px;
          transition: background 150ms;
        }

        .input-icon-right:hover { background: rgba(255,255,255,0.08); }

        .form-input--with-icon {
          padding-left: 2.75rem;
        }

        .form-input--with-icon-right {
          padding-right: 2.75rem;
        }

        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          color: #fca5a5;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .login-forgot {
          display: flex;
          justify-content: flex-end;
        }

        .link-btn {
          background: none;
          border: none;
          color: #60a5fa;
          font-size: 0.8rem;
          cursor: pointer;
          font-family: inherit;
          font-weight: 500;
          padding: 0;
          transition: color 150ms;
        }
        .link-btn:hover { color: #93c5fd; }

        .btn--loading { opacity: 0.8; }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 600ms linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-security-note {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1.25rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(99, 162, 255, 0.1);
          font-size: 0.7rem;
          color: #334155;
          text-align: center;
          justify-content: center;
        }

        .login-footer {
          font-size: 0.75rem;
          color: #1e293b;
        }

        .modal-icon {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 480px) {
          .login-card { padding: 1.75rem 1.25rem; }
          .login-demo-badges { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
