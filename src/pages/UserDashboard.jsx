/**
 * UserDashboard.jsx — TAS Tracking Application
 * =============================================
 * Standard user tracking view. Uses real API.
 */

import { useState } from 'react';
import { shipments as shipmentsApi } from '../utils/api';

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

function getStepIndex(status) { return STEPS.findIndex((s) => s.key === status); }

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function UserDashboard({ user, onLogout }) {
  const [trackingInput, setTrackingInput] = useState('');
  const [shipment, setShipment]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [searched, setSearched]           = useState(false);
  const [accessDenied, setAccessDenied]   = useState(false);
  const [notFound, setNotFound]           = useState(false);
  const [apiError, setApiError]           = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const id = trackingInput.trim().toUpperCase();
    if (!id) return;

    setLoading(true);
    setSearched(false);
    setApiError('');
    setAccessDenied(false);
    setNotFound(false);
    setShipment(null);

    try {
      const data = await shipmentsApi.get(id);
      setShipment(data);
      setSearched(true);
    } catch (err) {
      setSearched(true);
      if (err.status === 404) setNotFound(true);
      else if (err.status === 403) setAccessDenied(true);
      else setApiError(err.message || 'Failed to fetch shipment.');
    } finally {
      setLoading(false);
    }
  };

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
                <div className="step-dot">{isCompleted ? '✓' : isActive ? step.icon : idx + 1}</div>
                <div className="step-label">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
            <div className="navbar-avatar">{user.name[0].toUpperCase()}</div>
            <div>
              <div className="navbar-user-name">{user.name}</div>
              <div className="navbar-user-role">Standard User</div>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="page-content">
        {/* Search hero */}
        <div className="search-hero">
          <h1 className="search-hero-title">Track Your Shipment</h1>
          <p className="search-hero-sub">Enter a TAS Tracking ID to view real-time status and delivery updates.</p>
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="form-input search-input"
                placeholder="TAS-XXXXXXXX"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                maxLength={14}
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn--primary btn--lg" disabled={loading}>
              {loading ? <><span className="spinner" /> Tracking…</> : 'Track →'}
            </button>
          </form>

          {/* Quick-fill hints */}
          <div className="search-hints">
            <span className="text-muted text-sm">Try:</span>
            {['TAS-A1B2C3D4', 'TAS-E5F6G7H8'].map((id) => (
              <button key={id} type="button" className="hint-chip" onClick={() => setTrackingInput(id)}>{id}</button>
            ))}
          </div>
        </div>

        {/* Results */}
        {searched && notFound && (
          <div className="access-denied">
            <div className="access-icon">🔍</div>
            <h2 className="text-2xl fw-700">Not Found</h2>
            <p className="text-secondary">No shipment with ID <strong>{trackingInput}</strong> was found.</p>
          </div>
        )}

        {searched && accessDenied && (
          <div className="access-denied">
            <div className="access-icon">🔒</div>
            <h2 className="text-2xl fw-700">Access Restricted</h2>
            <p className="text-secondary" style={{ maxWidth: 420, textAlign: 'center' }}>
              You don't have permission to view shipment <strong>{trackingInput}</strong>. Contact your TAS administrator to request access.
            </p>
          </div>
        )}

        {searched && apiError && (
          <div className="access-denied">
            <div className="access-icon">⚠️</div>
            <h2 className="text-2xl fw-700">Error</h2>
            <p className="text-secondary">{apiError}</p>
          </div>
        )}

        {searched && shipment && (
          <div style={{ animation: 'fadeSlideIn 400ms ease' }}>
            {/* Header card */}
            <div className="card mb-6" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4a5a72' }}>Tracking ID</span>
                    <span style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.06em', color: '#f0f6ff' }}>{shipment.id}</span>
                    {shipment.is_public ? <span className="pub-chip">🌐 Public</span> : <span className="priv-chip">🔒 Restricted</span>}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{shipment.description}</div>
                </div>
                <span className={`status-badge status-badge--${shipment.status}`}>
                  <span className="status-dot" />{STATUS_LABELS[shipment.status]}
                </span>
              </div>

              {/* Progress bar */}
              {(() => {
                const activeIdx = getStepIndex(shipment.status);
                const pct = Math.round((activeIdx / (STEPS.length - 1)) * 100);
                return (
                  <>
                    <div style={{ height: 4, background: 'rgba(99,162,255,0.1)', borderRadius: 999, overflow: 'hidden', marginTop: '1.5rem', marginBottom: '0.375rem' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#2563eb,#06b6d4)', borderRadius: 999, transition: 'width 800ms ease' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#4a5a72', fontWeight: 600, textAlign: 'right' }}>Journey Progress — {pct}% complete</div>
                  </>
                );
              })()}
            </div>

            {/* Stepper */}
            <div className="card mb-6">
              <h3 className="card-section-title">📍 Shipment Journey</h3>
              {renderStepper(shipment.status)}
            </div>

            {/* Details */}
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

            {/* Timeline */}
            <div className="card">
              <h3 className="card-section-title">🕐 Activity Log</h3>
              {renderTimeline(shipment.logs || [])}
            </div>

            <p style={{ fontSize: '0.75rem', color: '#1e293b', textAlign: 'right', marginTop: '1rem' }}>
              Last updated: {fmtDate(shipment.updated_at)}
            </p>
          </div>
        )}

        {!searched && !loading && (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <p className="fw-600">Enter a tracking ID above</p>
            <p className="text-sm text-muted">You can track public shipments and any shipments your admin has granted you access to.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
        .pub-chip { font-size:0.7rem;font-weight:700;padding:2px 10px;border-radius:999px;background:rgba(6,182,212,0.12);border:1px solid rgba(6,182,212,0.3);color:#67e8f9; }
        .priv-chip { font-size:0.7rem;font-weight:700;padding:2px 10px;border-radius:999px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#fca5a5; }
        .card-section-title { font-size:0.875rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1.25rem; }
        .info-grid { display:flex;flex-direction:column;gap:0.75rem; }
        .info-row { display:flex;align-items:flex-start;gap:0.75rem;font-size:0.875rem; }
        .info-row-icon { font-size:1rem;flex-shrink:0;margin-top:1px; }
        .info-row-label { color:#4a5a72;min-width:110px;font-weight:500; }
        .info-row-value { color:#e2e8f0;font-weight:600; }
        .hint-chip { background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);color:#93c5fd;border-radius:999px;padding:0.25rem 0.875rem;font-size:0.75rem;font-family:monospace;cursor:pointer;transition:all 200ms;letter-spacing:0.04em;font-weight:600; }
        .hint-chip:hover { background:rgba(37,99,235,0.2);transform:translateY(-1px); }
        .spinner { width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 600ms linear infinite;display:inline-block; }
        @keyframes spin { to{transform:rotate(360deg);} }
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
