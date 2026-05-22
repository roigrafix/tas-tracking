/**
 * AdminDashboard.jsx — TAS Tracking Application
 * ================================================
 * Full admin control panel. Uses real API endpoints.
 *
 * Tabs:
 *  1. Overview   — stats + recent shipments
 *  2. Shipments  — full CRUD + log management
 *  3. Access     — RBAC grant/revoke matrix
 *  4. Users      — user listing
 */

import { useState, useEffect, useCallback } from 'react';
import { shipments as shipmentsApi, access as accessApi, users as usersApi, stats as statsApi } from '../utils/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUSES = ['processing', 'in_transit', 'customs', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = {
  processing:       'Processing',
  in_transit:       'In Transit',
  customs:          'Customs',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: '0.75rem 1.25rem', borderRadius: 10, fontWeight: 600, fontSize: '0.875rem',
          background: t.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(37,99,235,0.15)',
          border: `1px solid ${t.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(37,99,235,0.4)'}`,
          color: t.type === 'error' ? '#fca5a5' : '#93c5fd',
          backdropFilter: 'blur(10px)',
          animation: 'fadeSlideIn 300ms ease',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab]     = useState('overview');
  const [shipmentList, setShipmentList] = useState([]);
  const [userList, setUserList]       = useState([]);
  const [accessList, setAccessList]   = useState([]);
  const [statsData, setStatsData]     = useState({ total: 0, active: 0, delivered: 0, processing: 0 });
  const [loading, setLoading]         = useState(false);
  const [toasts, setToasts]           = useState([]);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal]       = useState(false);
  const [editingShipment, setEditingShipment] = useState(null);
  const [logTarget, setLogTarget]             = useState(null);
  const [deleteTarget, setDeleteTarget]       = useState(null);

  // Form state
  const [createForm, setCreateForm] = useState({ description: '', origin: '', destination: '', vessel: '', weight: '', dimensions: '', recipient: '', estimated_delivery: '', isPublic: false });
  const [logForm, setLogForm]       = useState({ event: '', location: '', note: '' });

  // ── Toast helper ─────────────────────────────────────────────────────────
  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, a, st] = await Promise.all([
        shipmentsApi.list(),
        usersApi.list(),
        accessApi.list(),
        statsApi.get(),
      ]);
      setShipmentList(s);
      setUserList(u);
      setAccessList(a);
      setStatsData(st);
    } catch (err) {
      toast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await shipmentsApi.create(createForm);
      toast('✅ Shipment created successfully');
      setShowCreateModal(false);
      setCreateForm({ description: '', origin: '', destination: '', vessel: '', weight: '', dimensions: '', recipient: '', estimated_delivery: '', isPublic: false });
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await shipmentsApi.update(id, { status });
      toast(`📦 Status updated to ${STATUS_LABELS[status]}`);
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await shipmentsApi.delete(id);
      toast(`🗑️ Shipment ${id} deleted`);
      setDeleteTarget(null);
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    try {
      await shipmentsApi.addLog(logTarget.id, logForm);
      toast('📋 Log entry added');
      setShowLogModal(false);
      setLogForm({ event: '', location: '', note: '' });
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleTogglePublic = async (id, current) => {
    try {
      await shipmentsApi.setPublic(id, !current);
      toast(`🌐 Shipment set to ${!current ? 'Public' : 'Restricted'}`);
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleGrant = async (userId, shipmentId) => {
    try {
      await accessApi.grant(userId, shipmentId);
      toast('✅ Access granted');
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleRevoke = async (userId, shipmentId) => {
    try {
      await accessApi.revoke(userId, shipmentId);
      toast('🔒 Access revoked');
      loadAll();
    } catch (err) { toast(err.message, 'error'); }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const hasAccess = (userId, shipmentId) =>
    accessList.some((a) => a.user_id === userId && a.shipment_id === shipmentId);

  const regularUsers = userList.filter((u) => u.role === 'user');
  const privateShipments = shipmentList.filter((s) => !s.is_public);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <div className="app-bg" />
      <Toast toasts={toasts} />

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">TAS</div>
          <div><div className="navbar-name">TAS</div><div className="navbar-tagline">Admin Panel</div></div>
        </div>
        <div className="navbar-actions">
          <div className="navbar-user">
            <div className="navbar-avatar" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
              {user.name[0].toUpperCase()}
            </div>
            <div>
              <div className="navbar-user-name">{user.name}</div>
              <div className="navbar-user-role" style={{ color: '#a78bfa' }}>Administrator</div>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="page-content">
        {/* Tab bar */}
        <div className="tab-bar">
          {[
            { key: 'overview',  label: '📊 Overview' },
            { key: 'shipments', label: '📦 Shipments' },
            { key: 'access',    label: '🔑 Access Control' },
            { key: 'users',     label: '👥 Users' },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#4a5a72' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem', border: '3px solid rgba(37,99,235,0.2)', borderTopColor: '#2563eb' }} />
            Loading…
          </div>
        )}

        {/* ── Overview Tab ── */}
        {!loading && activeTab === 'overview' && (
          <div>
            <div className="stats-grid mb-6">
              {[
                { label: 'Total Shipments', value: statsData.total,      icon: '📦', color: '#2563eb' },
                { label: 'Active',          value: statsData.active,     icon: '✈️', color: '#06b6d4' },
                { label: 'Processing',      value: statsData.processing, icon: '⚙️', color: '#f59e0b' },
                { label: 'Delivered',       value: statsData.delivered,  icon: '✅', color: '#10b981' },
              ].map((stat) => (
                <div key={stat.label} className="stat-card card">
                  <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="card-section-title">📦 Recent Shipments</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tracking ID</th><th>Description</th><th>Status</th><th>Origin</th><th>Destination</th><th>Visibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipmentList.slice(0, 8).map((s) => (
                      <tr key={s.id}>
                        <td><code>{s.id}</code></td>
                        <td>{s.description}</td>
                        <td><span className={`status-badge status-badge--${s.status}`}><span className="status-dot" />{STATUS_LABELS[s.status]}</span></td>
                        <td>{s.origin}</td>
                        <td>{s.destination}</td>
                        <td>{s.is_public ? '🌐 Public' : '🔒 Private'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Shipments Tab ── */}
        {!loading && activeTab === 'shipments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f0f6ff' }}>Shipment Management</h2>
              <button className="btn btn--primary" onClick={() => setShowCreateModal(true)}>+ New Shipment</button>
            </div>

            <div className="card">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th><th>Description</th><th>Status</th><th>Visibility</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipmentList.map((s) => (
                      <tr key={s.id}>
                        <td><code style={{ fontSize: '0.8rem' }}>{s.id}</code></td>
                        <td>{s.description}</td>
                        <td>
                          <select
                            className="form-input"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            value={s.status}
                            onChange={(e) => handleStatusUpdate(s.id, e.target.value)}
                          >
                            {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                          </select>
                        </td>
                        <td>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                            <input type="checkbox" checked={Boolean(s.is_public)} onChange={() => handleTogglePublic(s.id, s.is_public)} />
                            {s.is_public ? '🌐 Public' : '🔒 Private'}
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button className="btn btn--ghost btn--sm" onClick={() => { setLogTarget(s); setShowLogModal(true); }}>+ Log</button>
                            <button className="btn btn--sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }} onClick={() => setDeleteTarget(s.id)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Access Control Tab ── */}
        {!loading && activeTab === 'access' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f0f6ff', marginBottom: '0.5rem' }}>Access Control Matrix</h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Click a cell to grant or revoke a user's access to a private shipment. Public shipments (🌐) are accessible to everyone.
            </p>
            <div className="card">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      {privateShipments.map((s) => (
                        <th key={s.id} style={{ fontSize: '0.7rem', maxWidth: 100 }}>
                          <code>{s.id}</code>
                          <div style={{ color: '#4a5a72', fontWeight: 400 }}>{s.description?.slice(0, 20)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regularUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#4a5a72' }}>{u.email}</div>
                        </td>
                        {privateShipments.map((s) => {
                          const granted = hasAccess(u.id, s.id);
                          return (
                            <td key={s.id} style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => granted ? handleRevoke(u.id, s.id) : handleGrant(u.id, s.id)}
                                style={{
                                  background: granted ? 'rgba(16,185,129,0.15)' : 'rgba(99,162,255,0.05)',
                                  border: `1px solid ${granted ? 'rgba(16,185,129,0.4)' : 'rgba(99,162,255,0.15)'}`,
                                  borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer',
                                  color: granted ? '#6ee7b7' : '#4a5a72', fontSize: '1rem',
                                  transition: 'all 150ms', minWidth: 36
                                }}
                                title={granted ? 'Click to revoke' : 'Click to grant'}
                              >
                                {granted ? '✓' : '–'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {regularUsers.length === 0 && (
                      <tr><td colSpan={privateShipments.length + 1} style={{ textAlign: 'center', color: '#4a5a72' }}>No regular users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {!loading && activeTab === 'users' && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f0f6ff', marginBottom: '1.5rem' }}>User Management</h2>
            <div className="card">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Access Count</th></tr>
                  </thead>
                  <tbody>
                    {userList.map((u) => {
                      const accessCount = accessList.filter((a) => a.user_id === u.id).length;
                      return (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td style={{ color: '#64748b' }}>{u.email}</td>
                          <td>
                            <span style={{
                              padding: '2px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                              background: u.role === 'admin' ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.1)',
                              border: `1px solid ${u.role === 'admin' ? 'rgba(139,92,246,0.4)' : 'rgba(6,182,212,0.3)'}`,
                              color: u.role === 'admin' ? '#c4b5fd' : '#67e8f9',
                            }}>
                              {u.role === 'admin' ? '🛡️ Admin' : '👤 User'}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: u.is_active ? '#6ee7b7' : '#fca5a5', fontSize: '0.8rem', fontWeight: 600 }}>
                              {u.is_active ? '● Active' : '○ Inactive'}
                            </span>
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            {new Date(u.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', color: '#93c5fd', padding: '2px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700 }}>
                              {accessCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Shipment Modal ── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">New Shipment</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                ['Description', 'description', 'e.g. Electronic Components', true],
                ['Origin', 'origin', 'e.g. Dubai, UAE', false],
                ['Destination', 'destination', 'e.g. London, UK', false],
                ['Recipient', 'recipient', 'e.g. Company Name', false],
                ['Vessel / Flight', 'vessel', 'e.g. Emirates EK-007', false],
                ['Weight', 'weight', 'e.g. 120 kg', false],
                ['Dimensions', 'dimensions', 'e.g. 80 × 60 × 50 cm', false],
              ].map(([label, key, placeholder, required]) => (
                <div key={key}>
                  <label className="form-label">{label}{required && ' *'}</label>
                  <input
                    className="form-input"
                    placeholder={placeholder}
                    value={createForm[key]}
                    onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.value })}
                    required={required}
                  />
                </div>
              ))}
              <div>
                <label className="form-label">Est. Delivery Date</label>
                <input type="date" className="form-input" value={createForm.estimated_delivery} onChange={(e) => setCreateForm({ ...createForm, estimated_delivery: e.target.value })} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem', color: '#94a3b8' }}>
                <input type="checkbox" checked={createForm.isPublic} onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })} />
                Make this shipment publicly trackable (no login required)
              </label>
              <div className="flex gap-3" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>Create Shipment</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Log Modal ── */}
      {showLogModal && logTarget && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Log Entry</h2>
            <p style={{ fontSize: '0.8rem', color: '#4a5a72', marginBottom: '1rem' }}>For: <code>{logTarget.id}</code></p>
            <form onSubmit={handleAddLog} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Event *</label>
                <input className="form-input" placeholder="e.g. In Transit" value={logForm.event} onChange={(e) => setLogForm({ ...logForm, event: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Location</label>
                <input className="form-input" placeholder="e.g. Dubai International Airport" value={logForm.location} onChange={(e) => setLogForm({ ...logForm, location: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Note</label>
                <input className="form-input" placeholder="Additional details…" value={logForm.note} onChange={(e) => setLogForm({ ...logForm, note: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>Add Entry</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowLogModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>⚠️</div>
            <h2 className="modal-title">Delete Shipment?</h2>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              This will permanently delete <strong>{deleteTarget}</strong> and all its logs. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn btn--sm" style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }} onClick={() => handleDelete(deleteTarget)}>
                Yes, Delete
              </button>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
        .stats-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem; }
        .stat-card { padding:1.5rem;text-align:center; }
        .stat-icon { font-size:1.75rem;margin-bottom:0.5rem; }
        .stat-value { font-size:2.25rem;font-weight:900;color:#f0f6ff;line-height:1;margin-bottom:0.25rem; }
        .stat-label { font-size:0.75rem;color:#4a5a72;font-weight:600;text-transform:uppercase;letter-spacing:0.06em; }
        .tab-bar { display:flex;gap:0.25rem;margin-bottom:2rem;background:rgba(255,255,255,0.02);padding:0.25rem;border-radius:12px;border:1px solid rgba(99,162,255,0.08);flex-wrap:wrap; }
        .tab-btn { flex:1;padding:0.625rem 1rem;border-radius:9px;border:none;background:transparent;color:#4a5a72;font-size:0.875rem;font-weight:600;cursor:pointer;transition:all 200ms;font-family:inherit;white-space:nowrap;min-width:120px; }
        .tab-btn:hover { color:#94a3b8;background:rgba(255,255,255,0.04); }
        .tab-btn--active { background:rgba(37,99,235,0.15)!important;color:#93c5fd!important;border:1px solid rgba(37,99,235,0.3); }
        .admin-table-wrap { overflow-x:auto; }
        .admin-table { width:100%;border-collapse:collapse;font-size:0.875rem; }
        .admin-table th { text-align:left;padding:0.625rem 0.875rem;font-size:0.7rem;font-weight:700;color:#4a5a72;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid rgba(99,162,255,0.08); }
        .admin-table td { padding:0.75rem 0.875rem;border-bottom:1px solid rgba(99,162,255,0.04);color:#94a3b8; }
        .admin-table tr:last-child td { border-bottom:none; }
        .admin-table tr:hover td { background:rgba(255,255,255,0.015); }
        .card-section-title { font-size:0.875rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:1.25rem; }
        .spinner { display:inline-block;border-style:solid;border-radius:50%;animation:spin 600ms linear infinite; }
        @keyframes spin { to{transform:rotate(360deg);} }
      `}</style>
    </div>
  );
}
