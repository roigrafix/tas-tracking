/**
 * PublicTrack.jsx — TAS Tracking Application
 * ============================================
 * Public-facing landing page. No login required.
 * Uses the real backend API via /api/public/track with server-side reCAPTCHA verification.
 */

import { useState } from 'react';
import { publicApi } from '../utils/api';
import ReCaptcha from '../components/ReCaptcha';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'processing',       label: 'Order\nProcessed',   icon: '📦' },
  { key: 'in_transit',       label: 'In\nTransit',        icon: '✈️' },
  { key: 'customs',          label: 'Customs\nClearance', icon: '🛃' },
  { key: 'out_for_delivery', label: 'Out for\nDelivery',  icon: '🚚' },
  { key: 'delivered',        label: 'Delivered',          icon: '✅' },
];

const STATUS_LABELS = {
  processing:       'Order Processing',
  in_transit:       'In Transit',
  customs:          'Customs Clearance',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
};

function getStepIndex(status) {
  return STEPS.findIndex((s) => s.key === status);
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicTrack({ onGoToLogin }) {
  const [trackingInput, setTrackingInput]     = useState('');
  const [result, setResult]                   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [searched, setSearched]               = useState(false);
  const [error, setError]                     = useState('');
  const [captchaToken, setCaptchaToken]       = useState(null);
  const [captchaKey, setCaptchaKey]           = useState(0);
  const [showCaptchaWarn, setShowCaptchaWarn] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCaptchaVerify = (token) => {
    setCaptchaToken(token || null);
    if (token) setShowCaptchaWarn(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const id = trackingInput.trim().toUpperCase();
    if (!id) return;

    if (!captchaToken) {
      setShowCaptchaWarn(true);
      return;
    }

    setLoading(true);
    setSearched(false);
    setError('');
    setShowCaptchaWarn(false);

    try {
      const res = await publicApi.track(id, captchaToken);
      setResult(res);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setSearched(true);
      setResult(null);
    } finally {
      setLoading(false);
      // Always reset reCAPTCHA after a search (security best practice)
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
    }
  };

  const handleClear = () => {
    setTrackingInput('');
    setResult(null);
    setSearched(false);
    setError('');
    setCaptchaToken(null);
    setCaptchaKey((k) => k + 1);
  };

  // ── Render Stepper ──────────────────────────────────────────────────────────
  const renderStepper = (status) => {
    const activeIdx = getStepIndex(status);
    const progressPct = activeIdx === 0 ? 0 : (activeIdx / (STEPS.length - 1)) * 100;
    return (
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div className="stepper" style={{ position: 'relative', minWidth: 420 }}>
          <div className="progress-track" style={{ width: `${progressPct}%` }} />
          {STEPS.map((step, idx) => {
            const isCompleted = idx < activeIdx;
            const isActive    = idx === activeIdx;
            const cls = isCompleted ? 'step-item--completed' : isActive ? 'step-item--active' : '';
            return (
              <div key={step.key} className={`step-item ${cls}`}>
                <div className="step-dot">
                  {isCompleted ? '✓' : isActive ? step.icon : idx + 1}
                </div>
                <div className="step-label">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render Timeline ─────────────────────────────────────────────────────────
  const renderTimeline = (logs) => {
    const reversed = [...logs].reverse();
    return (
      <div className="timeline">
        {reversed.map((log, idx) => (
          <div key={idx} className="timeline-item">
            <div className="timeline-left">
              <div className="timeline-dot" />
              {idx < reversed.length - 1 && <div className="timeline-line" />}
            </div>
            <div className="timeline-content">
              <div className="timeline-event">{log.event}</div>
              <div className="timeline-note">{log.note}</div>
              <div className="timeline-meta">
                <span className="timeline-location">📍 {log.location}</span>
                <span className="timeline-time">🕐 {fmtDate(log.logged_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Render Shipment ─────────────────────────────────────────────────────────
  const renderShipment = (shipment) => {
    const activeIdx   = getStepIndex(shipment.status);
    const progressPct = Math.round((activeIdx / (STEPS.length - 1)) * 100);
    return (
      <div style={{ animation: 'fadeSlideIn 400ms ease' }}>
        <div className="card mb-6" style={{ padding: '1.75rem' }}>
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4a5a72' }}>Tracking ID</span>
                <span style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.06em', color: '#f0f6ff' }}>{shipment.id}</span>
                <span className="public-chip">🌐 Public</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{shipment.description}</div>
            </div>
            <span className={`status-badge status-badge--${shipment.status}`}>
              <span className="status-dot" />{STATUS_LABELS[shipment.status]}
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(99,162,255,0.1)', borderRadius: 999, overflow: 'hidden', marginTop: '1.5rem', marginBottom: '0.375rem' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#2563eb,#06b6d4)', borderRadius: 999, transition: 'width 800ms ease', boxShadow: '0 0 8px rgba(37,99,235,0.5)' }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: '#4a5a72', fontWeight: 600, textAlign: 'right' }}>Journey Progress — {progressPct}% complete</div>
        </div>

        <div className="card mb-6">
          <h3 className="card-section-title">📍 Shipment Journey</h3>
          {renderStepper(shipment.status)}
        </div>

        <div className="grid-2 mb-6">
          <div className="card">
            <h3 className="card-section-title">🗺️ Route Details</h3>
            <div className="info-grid">
              <InfoRow icon="📤" label="Origin"        value={shipment.origin} />
              <InfoRow icon="📥" label="Destination"   value={shipment.destination} />
              <InfoRow icon="📅" label="Est. Delivery" value={shipment.estimated_delivery} />
              <InfoRow icon="👤" label="Recipient"     value={shipment.recipient} />
            </div>
          </div>
          <div className="card">
            <h3 className="card-section-title">📦 Cargo Details</h3>
            <div className="info-grid">
              <InfoRow icon="✈️" label="Vessel / Flight" value={shipment.vessel} />
              <InfoRow icon="⚖️" label="Weight"          value={shipment.weight} />
              <InfoRow icon="📐" label="Dimensions"      value={shipment.dimensions} />
              <InfoRow icon="🏷️" label="Description"     value={shipment.description} />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-section-title">🕐 Activity Log</h3>
          {renderTimeline(shipment.logs || [])}
        </div>
        <p style={{ fontSize: '0.75rem', color: '#1e293b', textAlign: 'right', marginTop: '1rem' }}>
          Last updated: {fmtDate(shipment.updated_at)}
        </p>
      </div>
    );
  };

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <div className="app-bg" />
      <div className="public-grid-overlay" />

      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">TAS</div>
          <div>
            <div className="navbar-name">TAS</div>
            <div className="navbar-tagline">Track &amp; Ship</div>
          </div>
        </div>
        <div className="navbar-actions">
          <span className="public-nav-badge">🌐 Public Portal</span>
          <button id="public-login-btn" className="btn btn--primary btn--sm" onClick={onGoToLogin}>Sign In →</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="pub-hero">
        <div className="pub-hero-inner">
          <div className="pub-eyebrow"><span className="eyebrow-dot" />No account required</div>
          <h1 className="pub-title">Track Your Parcel<br /><span className="pub-title-accent">Instantly</span></h1>
          <p className="pub-subtitle">Enter your TAS Tracking ID below for real-time updates — no sign-in needed for public parcels.</p>

          <div className="pub-search-card glass-card">
            <form onSubmit={handleSearch} noValidate>
              <div className="pub-search-row">
                <div className="pub-input-wrap">
                  <span className="pub-search-icon">📦</span>
                  <input
                    id="public-tracking-input"
                    type="text"
                    className="form-input form-input--lg pub-input"
                    placeholder="e.g. TAS-A1B2C3D4"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                    maxLength={14}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                  />
                  {trackingInput && (
                    <button type="button" className="pub-clear" onClick={handleClear}>✕</button>
                  )}
                </div>
                <button id="public-track-btn" type="submit" className="btn btn--primary btn--lg pub-search-btn" disabled={loading}>
                  {loading ? <><span className="spinner" /> Tracking…</> : '🔍 Track'}
                </button>
              </div>

              {/* reCAPTCHA */}
              <div className="pub-captcha-wrap">
                <ReCaptcha key={captchaKey} onVerify={handleCaptchaVerify} theme="dark" />
                {showCaptchaWarn && (
                  <div className="captcha-warn">⚠️ Please complete the reCAPTCHA verification before searching.</div>
                )}
              </div>
            </form>

            <div className="pub-hints">
              <span className="text-muted text-sm">Try a public ID:</span>
              {['TAS-A1B2C3D4', 'TAS-M3N4O5P6'].map((id) => (
                <button key={id} type="button" className="hint-chip" onClick={() => setTrackingInput(id)}>{id}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="pub-results page-content" style={{ position: 'relative', zIndex: 1 }}>
        {/* API/network error */}
        {searched && error && (
          <div className="access-denied">
            <div className="access-icon">⚠️</div>
            <h2 className="text-2xl fw-700">Something went wrong</h2>
            <p className="text-secondary" style={{ maxWidth: 420, textAlign: 'center' }}>{error}</p>
            <button className="btn btn--ghost" onClick={handleClear}>Try Again</button>
          </div>
        )}

        {/* Not found */}
        {searched && result && !result.found && (
          <div className="access-denied">
            <div className="access-icon">🔍</div>
            <h2 className="text-2xl fw-700">Shipment Not Found</h2>
            <p className="text-secondary" style={{ maxWidth: 420, textAlign: 'center' }}>
              No shipment matching <strong>{trackingInput}</strong> was found. Please check your Tracking ID.
            </p>
            <button className="btn btn--ghost" onClick={handleClear}>Try Again</button>
          </div>
        )}

        {/* Found but restricted */}
        {searched && result && result.found && !result.access && (
          <div className="access-denied">
            <div className="access-icon">🔒</div>
            <h2 className="text-2xl fw-700">Private Shipment</h2>
            <p className="text-secondary" style={{ maxWidth: 460, textAlign: 'center' }}>
              Shipment <strong>{trackingInput}</strong> is restricted to authorised users. Sign in to check your access.
            </p>
            <div className="flex gap-3" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn--primary" onClick={onGoToLogin}>Sign In to Track →</button>
              <button className="btn btn--ghost btn--sm" onClick={handleClear}>Search Another ID</button>
            </div>
          </div>
        )}

        {/* Full shipment view */}
        {searched && result && result.found && result.access && renderShipment(result.shipment)}

        {/* Empty state */}
        {!searched && !loading && (
          <div className="empty-state" style={{ paddingTop: '1rem' }}>
            <div className="empty-icon">📭</div>
            <p className="fw-600">Results will appear here</p>
            <p className="text-sm text-muted">Complete the reCAPTCHA and press Track</p>
          </div>
        )}
      </div>

      {/* Features strip */}
      <div className="pub-features-strip">
        {[
          { icon: '⚡', title: 'Real-time Updates',  sub: 'Live status changes as they happen' },
          { icon: '🌍', title: 'Global Coverage',    sub: 'Air, sea, and land freight worldwide' },
          { icon: '🔐', title: 'Secure & Private',   sub: 'RBAC-protected for sensitive cargo' },
          { icon: '📱', title: 'Any Device',         sub: 'Mobile, tablet, and desktop ready' },
        ].map((f, i) => (
          <div key={f.title} style={{ display: 'flex' }}>
            {i > 0 && <div className="pub-feature-divider" />}
            <div className="pub-feature">
              <span className="pub-feature-icon">{f.icon}</span>
              <div>
                <div className="pub-feature-title">{f.title}</div>
                <div className="pub-feature-sub">{f.sub}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <footer className="pub-footer">
        <span>© 2026 TAS Track &amp; Ship — All rights reserved.</span>
        <div className="pub-footer-links">
          <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Contact Support</a>
          <button className="link-btn" onClick={onGoToLogin}>Staff Login →</button>
        </div>
      </footer>

      <style>{`
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .public-grid-overlay { position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(99,162,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(99,162,255,0.03) 1px,transparent 1px);background-size:80px 80px;z-index:0; }
        .public-nav-badge { font-size:0.7rem;font-weight:700;padding:4px 12px;border-radius:999px;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25);color:#67e8f9;letter-spacing:0.05em; }
        .pub-hero { display:flex;justify-content:center;padding:5rem 1.5rem 2rem;position:relative;z-index:1; }
        .pub-hero-inner { max-width:660px;width:100%;text-align:center; }
        .pub-eyebrow { display:inline-flex;align-items:center;gap:0.5rem;font-size:0.8rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#06b6d4;margin-bottom:1.25rem;padding:0.375rem 1rem;border-radius:999px;background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.2); }
        .eyebrow-dot { width:7px;height:7px;border-radius:50%;background:#06b6d4;animation:pulse 2s ease-in-out infinite; }
        .pub-title { font-size:clamp(2.5rem,6vw,4rem);font-weight:900;line-height:1.05;color:#f0f6ff;margin-bottom:1.25rem;letter-spacing:-0.02em; }
        .pub-title-accent { background:linear-gradient(90deg,#2563eb,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .pub-subtitle { font-size:1.05rem;color:#64748b;line-height:1.65;margin-bottom:2.5rem;max-width:560px;margin-left:auto;margin-right:auto; }
        .pub-search-card { padding:2rem;text-align:left; }
        .pub-search-row { display:flex;gap:0.75rem;align-items:stretch;margin-bottom:1.25rem; }
        .pub-input-wrap { flex:1;position:relative; }
        .pub-search-icon { position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:1.1rem;pointer-events:none;z-index:1; }
        .pub-input { padding-left:3rem!important;padding-right:2.5rem!important;letter-spacing:0.07em;font-weight:700;font-size:1.05rem!important;width:100%;height:100%; }
        .pub-clear { position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:24px;height:24px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.7rem;transition:background 150ms; }
        .pub-clear:hover { background:rgba(255,255,255,0.15);color:#f0f6ff; }
        .pub-search-btn { flex-shrink:0;min-width:130px; }
        .pub-captcha-wrap { margin-bottom:1.25rem; }
        .captcha-warn { margin-top:0.625rem;padding:0.625rem 1rem;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:0.8rem;color:#fcd34d; }
        .pub-hints { display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;padding-top:1rem;border-top:1px solid rgba(99,162,255,0.1); }
        .hint-chip { background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);color:#93c5fd;border-radius:999px;padding:0.25rem 0.875rem;font-size:0.75rem;font-family:monospace;cursor:pointer;transition:all 200ms;letter-spacing:0.04em;font-weight:600; }
        .hint-chip:hover { background:rgba(37,99,235,0.2);transform:translateY(-1px); }
        .public-chip { font-size:0.7rem;font-weight:700;padding:2px 10px;border-radius:999px;background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.3);color:#67e8f9; }
        .pub-results { max-width:900px;margin:0 auto; }
        .card-section-title { font-size:0.875rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1.25rem; }
        .info-grid { display:flex;flex-direction:column;gap:0.75rem; }
        .info-row { display:flex;align-items:flex-start;gap:0.75rem;font-size:0.875rem; }
        .info-row-icon { font-size:1rem;flex-shrink:0;margin-top:1px; }
        .info-row-label { color:#4a5a72;min-width:110px;font-weight:500; }
        .info-row-value { color:#e2e8f0;font-weight:600; }
        .spinner { width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 600ms linear infinite;display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .pub-features-strip { display:flex;align-items:center;justify-content:center;gap:0;padding:2rem;border-top:1px solid rgba(99,162,255,0.08);border-bottom:1px solid rgba(99,162,255,0.08);background:rgba(13,27,46,0.5);flex-wrap:wrap;position:relative;z-index:1;margin-top:3rem; }
        .pub-feature { display:flex;align-items:center;gap:0.875rem;padding:1rem 2rem; }
        .pub-feature-icon { font-size:1.5rem;flex-shrink:0; }
        .pub-feature-title { font-size:0.875rem;font-weight:700;color:#e2e8f0;margin-bottom:0.125rem; }
        .pub-feature-sub { font-size:0.75rem;color:#4a5a72; }
        .pub-feature-divider { width:1px;height:40px;background:rgba(99,162,255,0.12);flex-shrink:0; }
        .pub-footer { display:flex;align-items:center;justify-content:space-between;padding:1.5rem 2rem;font-size:0.75rem;color:#1e293b;flex-wrap:wrap;gap:1rem;position:relative;z-index:1; }
        .pub-footer-links { display:flex;gap:1.25rem;align-items:center;flex-wrap:wrap; }
        .pub-footer-links a { color:#334155;text-decoration:none;transition:color 150ms; }
        .pub-footer-links a:hover { color:#60a5fa; }
        .link-btn { background:none;border:none;color:#60a5fa;font-size:0.75rem;cursor:pointer;font-family:inherit;font-weight:600;padding:0;transition:color 150ms; }
        .link-btn:hover { color:#93c5fd; }
        @media (max-width:640px) { .pub-search-row{flex-direction:column;} .pub-search-btn{width:100%;} .pub-features-strip{flex-direction:column;} .pub-feature-divider{width:80%;height:1px;margin:0 auto;} .pub-footer{flex-direction:column;align-items:flex-start;} }
      `}</style>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="info-row">
      <span className="info-row-icon">{icon}</span>
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value || '—'}</span>
    </div>
  );
}
