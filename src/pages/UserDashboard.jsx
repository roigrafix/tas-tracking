/**
 * UserDashboard.jsx — TAS Tracking Application
 * ==============================================
 * Standard user view with tracking ID search, RBAC access check,
 * visual stepper timeline, cargo details, and event logs.
 */

import { useState } from 'react';
import db from '../utils/mockDb';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Ordered steps in the shipment lifecycle */
const STEPS = [
  { key: 'processing',       label: 'Order\nProcessed',     icon: '📦' },
  { key: 'in_transit',       label: 'In\nTransit',          icon: '✈️' },
  { key: 'customs',          label: 'Customs\nClearance',   icon: '🛃' },
  { key: 'out_for_delivery', label: 'Out for\nDelivery',    icon: '🚚' },
  { key: 'delivered',        label: 'Delivered',            icon: '✅' },
];

/** Human-readable status labels */
const STATUS_LABELS = {
  processing:       'Order Processing',
  in_transit:       'In Transit',
  customs:          'Customs Clearance',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
};

/** Return step index for a given status */
function getStepIndex(status) {
  return STEPS.findIndex((s) => s.key === status);
}

/** Format ISO timestamp to human-readable */
function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserDashboard({ user, onLogout }) {
  const [trackingInput, setTrackingInput] = useState('');
  const [result, setResult]               = useState(null); // null | { found, access, shipment }
  const [loading, setLoading]             = useState(false);
  const [searched, setSearched]           = useState(false);

  // ── Search Handler ──────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    const id = trackingInput.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setSearched(false);

    // Simulate network delay
    setTimeout(() => {
      const res = db.getShipmentByTrackingId(id, user.id);
      setResult(res);
      setSearched(true);
      setLoading(false);
    }, 600);
  };

  const handleClear = () => {
    setTrackingInput('');
    setResult(null);
    setSearched(false);
  };

  // ── Render Stepper ──────────────────────────────────────────────────────────
  const renderStepper = (status) => {
    const activeIdx = getStepIndex(status);
    // Progress bar width as % across the stepper
    const progressPct = activeIdx === 0 ? 0 : (activeIdx / (STEPS.length - 1)) * 100;

    return (
      <div className="stepper-wrap">
        {/* Track line */}
        <div className="stepper" style={{ position: 'relative' }}>
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

  // ── Render Timeline Logs ────────────────────────────────────────────────────
  const renderTimeline = (logs) => {
    // Show most-recent first
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
                <span className="timeline-time">🕐 {fmtDate(log.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Render Shipment Details ─────────────────────────────────────────────────
  const renderShipment = (shipment) => {
    const activeIdx = getStepIndex(shipment.status);
    const totalSteps = STEPS.length - 1;
    const progressPct = Math.round((activeIdx / totalSteps) * 100);

    return (
      <div className="shipment-result" style={{ animation: 'fadeSlideIn 400ms ease' }}>

        {/* ── Header strip ── */}
        <div className="result-header card mb-6">
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div className="result-tracking-id">
                <span className="tracking-label">Tracking ID</span>
                <span className="tracking-id-value">{shipment.id}</span>
                {shipment.isPublic && (
                  <span className="public-badge">🌐 Public</span>
                )}
              </div>
              <div className="result-description">{shipment.description}</div>
            </div>
            <div>
              <span className={`status-badge status-badge--${shipment.status}`}>
                <span className="status-dot" />
                {STATUS_LABELS[shipment.status]}
              </span>
            </div>
          </div>

          {/* Mini progress bar */}
          <div className="mini-progress-track">
            <div className="mini-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mini-progress-label">
            Journey Progress — {progressPct}% complete
          </div>
        </div>

        {/* ── Visual Stepper ── */}
        <div className="card mb-6">
          <h3 className="card-section-title">📍 Shipment Journey</h3>
          {renderStepper(shipment.status)}
        </div>

        {/* ── Route + Vessel info ── */}
        <div className="grid-2 mb-6">
          {/* Route */}
          <div className="card">
            <h3 className="card-section-title">🗺️ Route Details</h3>
            <div className="info-grid">
              <InfoRow icon="📤" label="Origin"       value={shipment.origin} />
              <InfoRow icon="📥" label="Destination"  value={shipment.destination} />
              <InfoRow icon="📅" label="Est. Delivery" value={shipment.estimatedDelivery} />
              <InfoRow icon="👤" label="Recipient"    value={shipment.recipient} />
            </div>
          </div>

          {/* Cargo details */}
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

        {/* ── Activity Timeline ── */}
        <div className="card">
          <h3 className="card-section-title">🕐 Activity Log</h3>
          {renderTimeline(shipment.logs)}
        </div>

        {/* Updated at */}
        <p className="result-updated">
          Last updated: {fmtDate(shipment.updatedAt)}
        </p>
      </div>
    );
  };

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <div className="app-bg" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">TAS</div>
          <div>
            <div className="navbar-name">TAS</div>
            <div className="navbar-tagline">Track &amp; Ship</div>
          </div>
        </div>
        <div className="navbar-actions">
          <div className="navbar-user">
            <div className="navbar-avatar">{user.name[0]}</div>
            <span>{user.name}</span>
            <span className="role-badge role-badge--user">User</span>
          </div>
          <button id="logout-btn" className="btn btn--ghost btn--sm" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Hero Search ── */}
        <div className="user-hero">
          <div className="user-hero-inner">
            <div className="user-hero-eyebrow">🌍 Real-time cargo tracking</div>
            <h1 className="user-hero-title">Track Your Shipment</h1>
            <p className="user-hero-sub">
              Enter your unique Tracking ID to get live status updates, location history, and delivery estimates.
            </p>

            {/* Search form */}
            <form onSubmit={handleSearch} className="search-form">
              <div className="search-input-wrap">
                <span className="search-icon">🔍</span>
                <input
                  id="tracking-id-input"
                  type="text"
                  className="form-input form-input--lg search-input"
                  placeholder="e.g. TAS-A1B2C3D4"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                  maxLength={14}
                  autoComplete="off"
                  spellCheck={false}
                />
                {trackingInput && (
                  <button type="button" className="search-clear" onClick={handleClear} title="Clear">
                    ✕
                  </button>
                )}
              </div>
              <button
                id="track-submit-btn"
                type="submit"
                className="btn btn--primary btn--lg search-btn"
                disabled={loading || !trackingInput.trim()}
              >
                {loading ? <><span className="spinner" /> Tracking…</> : 'Track Now'}
              </button>
            </form>

            {/* Sample IDs hint */}
            <div className="search-hints">
              <span className="text-muted text-sm">Try:</span>
              {['TAS-A1B2C3D4', 'TAS-M3N4O5P6'].map((id) => (
                <button
                  key={id}
                  type="button"
                  className="hint-chip"
                  onClick={() => setTrackingInput(id)}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results Area ── */}
        {searched && result && (
          <>
            {/* Not found */}
            {!result.found && (
              <div className="access-denied">
                <div className="access-icon">🔍</div>
                <h2 className="text-2xl fw-700">Shipment Not Found</h2>
                <p className="text-secondary">
                  No shipment with tracking ID <strong>{trackingInput}</strong> was found in our system.
                  Please double-check your ID and try again.
                </p>
                <button className="btn btn--ghost" onClick={handleClear}>Clear &amp; Search Again</button>
              </div>
            )}

            {/* Found but no access */}
            {result.found && !result.access && (
              <div className="access-denied">
                <div className="access-icon">🔒</div>
                <h2 className="text-2xl fw-700">Access Restricted</h2>
                <p className="text-secondary" style={{ maxWidth: 480, textAlign: 'center' }}>
                  Tracking ID <strong>{trackingInput}</strong> exists but is restricted to authorized users only.
                  Please contact your TAS account manager to request access.
                </p>
                <div className="flex gap-3">
                  <button className="btn btn--ghost btn--sm" onClick={handleClear}>Search Again</button>
                  <button className="btn btn--primary btn--sm">Request Access</button>
                </div>
              </div>
            )}

            {/* Found with access */}
            {result.found && result.access && renderShipment(result.shipment)}
          </>
        )}

        {/* ── Empty state before search ── */}
        {!searched && !loading && (
          <div className="empty-state" style={{ marginTop: '2rem' }}>
            <div className="empty-icon">📭</div>
            <p className="fw-600">Enter a Tracking ID above to get started</p>
            <p className="text-sm text-muted">Your shipment information will appear here</p>
          </div>
        )}
      </div>

      {/* Inline styles for user dashboard */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .user-hero {
          display: flex;
          justify-content: center;
          padding: 3rem 0 2.5rem;
        }

        .user-hero-inner {
          max-width: 640px;
          width: 100%;
          text-align: center;
        }

        .user-hero-eyebrow {
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #06b6d4;
          margin-bottom: 0.75rem;
        }

        .user-hero-title {
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 900;
          background: linear-gradient(135deg, #f0f6ff 30%, #93c5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.75rem;
          line-height: 1.1;
        }

        .user-hero-sub {
          color: #64748b;
          font-size: 1rem;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .search-form {
          display: flex;
          gap: 0.75rem;
          align-items: stretch;
        }

        .search-input-wrap {
          flex: 1;
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
          pointer-events: none;
          z-index: 1;
        }

        .search-input {
          padding-left: 3rem !important;
          padding-right: 2.5rem !important;
          letter-spacing: 0.06em;
          font-weight: 600;
          font-size: 1.05rem !important;
          width: 100%;
        }

        .search-clear {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,0.08);
          border: none;
          color: #94a3b8;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          transition: background 150ms;
        }

        .search-clear:hover { background: rgba(255,255,255,0.15); color: #f0f6ff; }

        .search-btn {
          flex-shrink: 0;
          min-width: 130px;
        }

        .search-hints {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          justify-content: center;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .hint-chip {
          background: rgba(37, 99, 235, 0.1);
          border: 1px solid rgba(37, 99, 235, 0.25);
          color: #93c5fd;
          border-radius: 999px;
          padding: 0.25rem 0.875rem;
          font-size: 0.75rem;
          font-family: 'Inter', monospace;
          cursor: pointer;
          transition: all 200ms;
          letter-spacing: 0.04em;
          font-weight: 600;
        }

        .hint-chip:hover {
          background: rgba(37, 99, 235, 0.2);
          transform: translateY(-1px);
        }

        /* Result header */
        .result-header { padding: 1.75rem; }

        .result-tracking-id {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.375rem;
        }

        .tracking-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #4a5a72;
        }

        .tracking-id-value {
          font-size: 1.375rem;
          font-weight: 800;
          font-family: 'Inter', monospace;
          letter-spacing: 0.06em;
          color: #f0f6ff;
        }

        .public-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 999px;
          background: rgba(6, 182, 212, 0.12);
          border: 1px solid rgba(6, 182, 212, 0.3);
          color: #67e8f9;
        }

        .result-description {
          font-size: 0.875rem;
          color: #64748b;
        }

        .mini-progress-track {
          height: 4px;
          background: rgba(99,162,255,0.1);
          border-radius: 999px;
          overflow: hidden;
          margin-top: 1.5rem;
          margin-bottom: 0.375rem;
        }

        .mini-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2563eb, #06b6d4);
          border-radius: 999px;
          transition: width 800ms ease;
          box-shadow: 0 0 8px rgba(37,99,235,0.5);
        }

        .mini-progress-label {
          font-size: 0.7rem;
          color: #4a5a72;
          font-weight: 600;
          text-align: right;
        }

        .card-section-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.25rem;
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .info-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.875rem;
        }

        .info-row-icon { font-size: 1rem; flex-shrink: 0; margin-top: 1px; }
        .info-row-label { color: #4a5a72; min-width: 110px; font-weight: 500; }
        .info-row-value { color: #e2e8f0; font-weight: 600; }

        .result-updated {
          font-size: 0.75rem;
          color: #1e293b;
          text-align: right;
          margin-top: 1rem;
        }

        .stepper-wrap { overflow-x: auto; padding-bottom: 0.5rem; }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 600ms linear infinite;
          display: inline-block;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .search-form { flex-direction: column; }
          .search-btn { width: 100%; }
        }
      `}</style>
    </div>
  );
}

/** Small info row sub-component */
function InfoRow({ icon, label, value }) {
  return (
    <div className="info-row">
      <span className="info-row-icon">{icon}</span>
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value || '—'}</span>
    </div>
  );
}
