/**
 * AdminDashboard.jsx — TAS Tracking Application
 * ===============================================
 * Full admin control panel with:
 *  - Overview stats (active, delivered, processing, total)
 *  - Shipment management (create, update status, add log entries, delete)
 *  - RBAC panel (grant/revoke user access per shipment, toggle public)
 *  - User management overview
 */

import { useState, useEffect, useCallback } from 'react';
import db from '../utils/mockDb';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'processing',       label: '📋 Order Processing' },
  { value: 'in_transit',       label: '✈️ In Transit' },
  { value: 'customs',          label: '🛃 Customs Clearance' },
  { value: 'out_for_delivery', label: '🚚 Out for Delivery' },
  { value: 'delivered',        label: '✅ Delivered' },
];

const STATUS_LABELS = {
  processing:       'Processing',
  in_transit:       'In Transit',
  customs:          'Customs',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
};

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Toast Hook ────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return { toasts, addToast };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [shipments, setShipments] = useState([]);
  const [users, setUsers]         = useState([]);
  const [stats, setStats]         = useState({});
  const { toasts, addToast }      = useToast();

  // Form states
  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [showUpdateModal, setShowUpdateModal]       = useState(false);
  const [showLogModal, setShowLogModal]             = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [selectedShipment, setSelectedShipment]     = useState(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    origin: '', destination: '', vessel: '', weight: '',
    dimensions: '', estimatedDelivery: '', recipient: '',
    description: '', status: 'processing', isPublic: false,
  });

  // Update form
  const [updateForm, setUpdateForm] = useState({ status: '', vessel: '', estimatedDelivery: '' });

  // Log form
  const [logForm, setLogForm] = useState({ location: '', event: '', note: '' });

  // ── Load data ───────────────────────────────────────────────────────────────
  const refreshData = useCallback(() => {
    setShipments(db.getShipments());
    setUsers(db.getUsers().filter((u) => u.role === 'user')); // Only non-admin users
    setStats(db.getStats());
  }, []);

  useEffect(() => { refreshData(); }, [refreshData]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  /** Create a new shipment */
  const handleCreate = (e) => {
    e.preventDefault();
    const ship = db.createShipment(createForm);
    refreshData();
    setShowCreateModal(false);
    setCreateForm({
      origin: '', destination: '', vessel: '', weight: '',
      dimensions: '', estimatedDelivery: '', recipient: '',
      description: '', status: 'processing', isPublic: false,
    });
    addToast(`Shipment ${ship.id} created successfully!`, 'success');
  };

  /** Update an existing shipment's status / details */
  const handleUpdate = (e) => {
    e.preventDefault();
    db.updateShipment(selectedShipment.id, updateForm);
    refreshData();
    setShowUpdateModal(false);
    addToast(`Shipment ${selectedShipment.id} updated.`, 'success');
  };

  /** Add a log entry to a shipment */
  const handleAddLog = (e) => {
    e.preventDefault();
    db.addShipmentLog(selectedShipment.id, logForm);
    refreshData();
    setShowLogModal(false);
    setLogForm({ location: '', event: '', note: '' });
    addToast(`Log added to ${selectedShipment.id}.`, 'info');
  };

  /** Delete a shipment */
  const handleDelete = () => {
    db.deleteShipment(selectedShipment.id);
    refreshData();
    setShowDeleteConfirm(false);
    addToast(`Shipment ${selectedShipment.id} deleted.`, 'error');
  };

  /** Toggle public access for a shipment */
  const handleTogglePublic = (ship) => {
    db.setShipmentPublic(ship.id, !ship.isPublic);
    refreshData();
    addToast(`${ship.id} set to ${!ship.isPublic ? 'Public' : 'Restricted'}.`, 'info');
  };

  /** Grant or revoke user access */
  const handleToggleAccess = (userId, shipmentId, currentlyHas) => {
    if (currentlyHas) {
      db.revokeAccess(userId, shipmentId);
      addToast('Access revoked.', 'error');
    } else {
      db.grantAccess(userId, shipmentId);
      addToast('Access granted.', 'success');
    }
    refreshData();
  };

  // ── Render Tabs ─────────────────────────────────────────────────────────────
  const TABS = [
    { key: 'overview',   label: '📊 Overview' },
    { key: 'shipments',  label: '📦 Shipments' },
    { key: 'rbac',       label: '🔐 Access Control' },
    { key: 'users',      label: '👥 Users' },
  ];

  // ── Overview Tab ─────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div style={{ animation: 'fadeSlideIn 300ms ease' }}>
      {/* Stats Grid */}
      <div className="grid-4 mb-8">
        <StatCard icon="📦" iconClass="stat-icon--blue" value={stats.total || 0}     label="Total Shipments" />
        <StatCard icon="✈️" iconClass="stat-icon--cyan" value={stats.active || 0}    label="Active Shipments" />
        <StatCard icon="📋" iconClass="stat-icon--amber" value={stats.processing || 0} label="Processing" />
        <StatCard icon="✅" iconClass="stat-icon--green" value={stats.delivered || 0} label="Delivered" />
      </div>

      {/* Recent Shipments Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="fw-700 text-lg">Recent Shipments</h3>
          <button
            id="quick-create-btn"
            className="btn btn--primary btn--sm"
            onClick={() => setShowCreateModal(true)}
          >
            + New Shipment
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tracking ID</th>
                <th>Description</th>
                <th>Route</th>
                <th>Status</th>
                <th>Access</th>
                <th>Est. Delivery</th>
              </tr>
            </thead>
            <tbody>
              {shipments.slice(0, 5).map((ship) => (
                <tr key={ship.id}>
                  <td>
                    <span className="mono-id">{ship.id}</span>
                  </td>
                  <td>{ship.description}</td>
                  <td className="text-sm text-secondary">
                    {ship.origin} → {ship.destination}
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${ship.status}`}>
                      <span className="status-dot" />
                      {STATUS_LABELS[ship.status]}
                    </span>
                  </td>
                  <td>
                    {ship.isPublic
                      ? <span className="access-tag access-tag--public">🌐 Public</span>
                      : <span className="access-tag access-tag--restricted">🔒 Restricted ({ship.allowedUsers.length})</span>
                    }
                  </td>
                  <td className="text-sm">{ship.estimatedDelivery || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shipments.length > 5 && (
          <button className="btn btn--ghost btn--sm mt-4" onClick={() => setActiveTab('shipments')}>
            View all {shipments.length} shipments →
          </button>
        )}
      </div>
    </div>
  );

  // ── Shipments Tab ─────────────────────────────────────────────────────────────
  const renderShipments = () => (
    <div style={{ animation: 'fadeSlideIn 300ms ease' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Shipment Management</h2>
          <p className="section-sub">Create, update, and manage all active cargo shipments.</p>
        </div>
        <button
          id="create-shipment-btn"
          className="btn btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Shipment
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tracking ID</th>
                <th>Description</th>
                <th>Route</th>
                <th>Status</th>
                <th>Vessel</th>
                <th>Est. Delivery</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#4a5a72' }}>
                    No shipments yet. Create your first one!
                  </td>
                </tr>
              ) : shipments.map((ship) => (
                <tr key={ship.id}>
                  <td><span className="mono-id">{ship.id}</span></td>
                  <td className="text-sm">{ship.description}</td>
                  <td className="text-sm text-secondary">
                    <div>{ship.origin}</div>
                    <div style={{ color: '#4a5a72' }}>→ {ship.destination}</div>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${ship.status}`}>
                      <span className="status-dot" />
                      {STATUS_LABELS[ship.status]}
                    </span>
                  </td>
                  <td className="text-sm text-secondary">{ship.vessel || '—'}</td>
                  <td className="text-sm">{ship.estimatedDelivery || '—'}</td>
                  <td>
                    <label className="toggle" title={ship.isPublic ? 'Set Restricted' : 'Set Public'}>
                      <input
                        type="checkbox"
                        checked={ship.isPublic}
                        onChange={() => handleTogglePublic(ship)}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {ship.isPublic ? '🌐 Public' : '🔒 Restricted'}
                    </div>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="btn btn--ghost btn--sm"
                        title="Update status"
                        onClick={() => {
                          setSelectedShipment(ship);
                          setUpdateForm({ status: ship.status, vessel: ship.vessel, estimatedDelivery: ship.estimatedDelivery });
                          setShowUpdateModal(true);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn--accent btn--sm"
                        title="Add event log"
                        onClick={() => {
                          setSelectedShipment(ship);
                          setShowLogModal(true);
                        }}
                      >
                        📝
                      </button>
                      <button
                        className="btn btn--danger btn--sm"
                        title="Delete shipment"
                        onClick={() => {
                          setSelectedShipment(ship);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ── RBAC Tab ─────────────────────────────────────────────────────────────────
  const renderRBAC = () => (
    <div style={{ animation: 'fadeSlideIn 300ms ease' }}>
      <h2 className="section-title">Access Control (RBAC)</h2>
      <p className="section-sub">
        Grant or revoke user access to specific shipments. Toggle cells to manage permissions.
        Public shipments are visible to all logged-in users.
      </p>

      {users.length === 0 || shipments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <p className="fw-600">No users or shipments to manage yet.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>User</th>
                  {shipments.map((ship) => (
                    <th key={ship.id} style={{ minWidth: 130, textAlign: 'center' }}>
                      <div className="mono-id-sm">{ship.id}</div>
                      <div className="text-xs text-muted" style={{ fontWeight: 400, marginTop: 2 }}>
                        {ship.isPublic
                          ? <span style={{ color: '#22d3ee' }}>🌐 Public</span>
                          : '🔒 Restricted'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="navbar-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                          {u.name[0]}
                        </div>
                        <div>
                          <div className="text-sm fw-600">{u.name}</div>
                          <div className="text-xs text-muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    {shipments.map((ship) => {
                      const hasAccess = ship.isPublic || ship.allowedUsers.includes(u.id);
                      const isPublic  = ship.isPublic;
                      return (
                        <td key={ship.id} style={{ textAlign: 'center' }}>
                          {isPublic ? (
                            <span className="rbac-cell rbac-cell--public" title="Public shipment — accessible to all">
                              🌐
                            </span>
                          ) : (
                            <button
                              className={`rbac-toggle-btn ${hasAccess ? 'rbac-toggle-btn--granted' : 'rbac-toggle-btn--denied'}`}
                              onClick={() => handleToggleAccess(u.id, ship.id, hasAccess)}
                              title={hasAccess ? 'Click to revoke access' : 'Click to grant access'}
                            >
                              {hasAccess ? '✓ Granted' : '✕ Denied'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ── Users Tab ─────────────────────────────────────────────────────────────────
  const renderUsers = () => {
    const allUsers = db.getUsers();
    return (
      <div style={{ animation: 'fadeSlideIn 300ms ease' }}>
        <h2 className="section-title">User Accounts</h2>
        <p className="section-sub">All registered users on the TAS platform.</p>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Member Since</th>
                  <th>Accessible Shipments</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => {
                  const accessible = u.role === 'admin'
                    ? shipments.length
                    : shipments.filter((s) => s.isPublic || s.allowedUsers.includes(u.id)).length;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="navbar-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                            {u.name[0]}
                          </div>
                          <span className="fw-600 text-sm">{u.name}</span>
                        </div>
                      </td>
                      <td className="text-secondary text-sm">{u.email}</td>
                      <td>
                        <span className={`role-badge ${u.role === 'admin' ? 'role-badge--admin' : 'role-badge--user'}`}>
                          {u.role === 'admin' ? '🛡️ Admin' : '👤 User'}
                        </span>
                      </td>
                      <td className="text-sm text-secondary">{fmtDate(u.createdAt)}</td>
                      <td>
                        <span className="text-sm fw-600" style={{ color: '#60a5fa' }}>
                          {accessible} shipment{accessible !== 1 ? 's' : ''}
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
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-root">
      <div className="app-bg" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">TAS</div>
          <div>
            <div className="navbar-name">TAS</div>
            <div className="navbar-tagline">Admin Control Panel</div>
          </div>
        </div>
        <div className="navbar-actions">
          <div className="navbar-user">
            <div className="navbar-avatar">{user.name[0]}</div>
            <span>{user.name}</span>
            <span className="role-badge role-badge--admin">Admin</span>
          </div>
          <button id="admin-logout-btn" className="btn btn--ghost btn--sm" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div className="page-content" style={{ position: 'relative', zIndex: 1 }}>

        {/* Page title */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Admin Dashboard</h1>
            <p className="text-secondary text-sm">Manage shipments, users, and access control for TAS.</p>
          </div>
          <div className="admin-header-time">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className={`tab-btn ${activeTab === tab.key ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview'  && renderOverview()}
        {activeTab === 'shipments' && renderShipments()}
        {activeTab === 'rbac'      && renderRBAC()}
        {activeTab === 'users'     && renderUsers()}
      </div>

      {/* ── Create Shipment Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-box" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">📦 Create New Shipment</h2>
            <form onSubmit={handleCreate}>
              <div className="modal-form-grid">
                <FormField label="Origin *"          id="cf-origin"      value={createForm.origin}      onChange={(v) => setCreateForm({...createForm, origin: v})}      placeholder="e.g. Dubai, UAE" required />
                <FormField label="Destination *"     id="cf-dest"        value={createForm.destination} onChange={(v) => setCreateForm({...createForm, destination: v})} placeholder="e.g. London, UK" required />
                <FormField label="Vessel / Flight"   id="cf-vessel"      value={createForm.vessel}      onChange={(v) => setCreateForm({...createForm, vessel: v})}      placeholder="e.g. Emirates EK-007" />
                <FormField label="Est. Delivery"     id="cf-delivery"    type="date" value={createForm.estimatedDelivery} onChange={(v) => setCreateForm({...createForm, estimatedDelivery: v})} />
                <FormField label="Weight"            id="cf-weight"      value={createForm.weight}      onChange={(v) => setCreateForm({...createForm, weight: v})}      placeholder="e.g. 120 kg" />
                <FormField label="Dimensions"        id="cf-dims"        value={createForm.dimensions}  onChange={(v) => setCreateForm({...createForm, dimensions: v})}  placeholder="e.g. 80 × 60 × 50 cm" />
                <FormField label="Recipient"         id="cf-recipient"   value={createForm.recipient}   onChange={(v) => setCreateForm({...createForm, recipient: v})}   placeholder="Company or person name" />
                <FormField label="Description *"     id="cf-desc"        value={createForm.description} onChange={(v) => setCreateForm({...createForm, description: v})} placeholder="e.g. Electronic Components" required />
              </div>
              <div className="form-group mb-4">
                <label className="form-label">Initial Status</label>
                <select
                  className="form-select"
                  value={createForm.status}
                  onChange={(e) => setCreateForm({...createForm, status: e.target.value})}
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <label className="form-checkbox-row mb-4">
                <input
                  type="checkbox"
                  checked={createForm.isPublic}
                  onChange={(e) => setCreateForm({...createForm, isPublic: e.target.checked})}
                />
                <span className="text-sm fw-600">Make shipment publicly visible (no RBAC required)</span>
              </label>
              <div className="flex gap-3">
                <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>
                  Create Shipment
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Update Shipment Modal ─────────────────────────────────────────────── */}
      {showUpdateModal && selectedShipment && (
        <div className="modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">✏️ Update Shipment</h2>
            <p className="text-secondary text-sm mb-4">
              Editing: <span className="mono-id">{selectedShipment.id}</span>
            </p>
            <form onSubmit={handleUpdate}>
              <div className="form-group mb-4">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})}
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <FormField label="Vessel / Flight" id="uf-vessel" value={updateForm.vessel} onChange={(v) => setUpdateForm({...updateForm, vessel: v})} placeholder="Update vessel or flight number" />
              <div className="form-group mb-4" style={{ marginTop: '1rem' }}>
                <label className="form-label">Est. Delivery Date</label>
                <input type="date" className="form-input" value={updateForm.estimatedDelivery} onChange={(e) => setUpdateForm({...updateForm, estimatedDelivery: e.target.value})} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowUpdateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Log Modal ─────────────────────────────────────────────────────── */}
      {showLogModal && selectedShipment && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">📝 Add Event Log</h2>
            <p className="text-secondary text-sm mb-4">
              Adding log to: <span className="mono-id">{selectedShipment.id}</span>
            </p>
            <form onSubmit={handleAddLog}>
              <FormField label="Location *"    id="lf-loc"   value={logForm.location} onChange={(v) => setLogForm({...logForm, location: v})} placeholder="e.g. Frankfurt Airport" required />
              <div style={{ marginTop: '1rem' }}>
                <div className="form-group mb-4">
                  <label className="form-label">Event *</label>
                  <select className="form-select" value={logForm.event} onChange={(e) => setLogForm({...logForm, event: e.target.value})} required>
                    <option value="">Select event type…</option>
                    <option>Order Processed</option>
                    <option>In Transit</option>
                    <option>Customs Clearance</option>
                    <option>Out for Delivery</option>
                    <option>Delivered</option>
                    <option>Delay Notice</option>
                    <option>Exception</option>
                  </select>
                </div>
              </div>
              <FormField label="Note" id="lf-note" value={logForm.note} onChange={(v) => setLogForm({...logForm, note: v})} placeholder="Optional details about this event" />
              <div className="flex gap-3" style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn--accent" style={{ flex: 1 }}>Add Log Entry</button>
                <button type="button" className="btn btn--ghost" onClick={() => setShowLogModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────────────── */}
      {showDeleteConfirm && selectedShipment && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
            <h2 className="modal-title" style={{ textAlign: 'center' }}>Delete Shipment?</h2>
            <p className="text-secondary text-sm mb-6" style={{ textAlign: 'center' }}>
              This will permanently delete shipment <strong>{selectedShipment.id}</strong> and all its logs. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button className="btn btn--danger" style={{ flex: 1 }} onClick={handleDelete}>
                Yes, Delete
              </button>
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ───────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
            {t.message}
          </div>
        ))}
      </div>

      {/* Inline admin styles */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .admin-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.75rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .admin-page-title {
          font-size: 1.875rem;
          font-weight: 900;
          background: linear-gradient(135deg, #f0f6ff, #93c5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .admin-header-time {
          font-size: 0.8rem;
          color: #334155;
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(99,162,255,0.1);
          border-radius: 8px;
        }

        .mono-id {
          font-family: 'Inter', monospace;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #60a5fa;
          background: rgba(37,99,235,0.1);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .mono-id-sm {
          font-family: 'Inter', monospace;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #60a5fa;
        }

        .access-tag {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .access-tag--public {
          background: rgba(6,182,212,0.1);
          color: #67e8f9;
          border: 1px solid rgba(6,182,212,0.25);
        }

        .access-tag--restricted {
          background: rgba(245,158,11,0.1);
          color: #fcd34d;
          border: 1px solid rgba(245,158,11,0.25);
        }

        .action-btns {
          display: flex;
          gap: 0.375rem;
          align-items: center;
        }

        .rbac-cell {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          padding: 0.25rem;
        }

        .rbac-cell--public { color: #22d3ee; }

        .rbac-toggle-btn {
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid;
          font-family: 'Inter', sans-serif;
          transition: all 200ms ease;
          white-space: nowrap;
        }

        .rbac-toggle-btn--granted {
          background: rgba(16,185,129,0.15);
          border-color: rgba(16,185,129,0.35);
          color: #6ee7b7;
        }

        .rbac-toggle-btn--granted:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.3);
          color: #fca5a5;
        }

        .rbac-toggle-btn--denied {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.25);
          color: #fca5a5;
        }

        .rbac-toggle-btn--denied:hover {
          background: rgba(16,185,129,0.15);
          border-color: rgba(16,185,129,0.3);
          color: #6ee7b7;
        }

        .modal-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem 1rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 640px) {
          .modal-form-grid { grid-template-columns: 1fr; }
          .admin-page-title { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, iconClass, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Form Field ────────────────────────────────────────────────────────────────
function FormField({ label, id, value, onChange, placeholder, type = 'text', required = false }) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        type={type}
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
