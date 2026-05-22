/**
 * mockDb.js — TAS Tracking Application
 * =====================================
 * In-memory + localStorage-backed mock database.
 * Simulates a real backend with Users, Shipments, and RBAC access control.
 *
 * In production, replace these helpers with real API calls (REST or GraphQL).
 */

// ─── Seed Data ────────────────────────────────────────────────────────────────

/** Seed users loaded on first run. Passwords are plain-text here for demo only.
 *  In production: bcrypt-hash passwords and store them server-side. */
const SEED_USERS = [
  {
    id: 'usr_admin_001',
    name: 'TAS Administrator',
    email: 'admin@tas.com',
    password: 'admin123',
    role: 'admin', // 'admin' | 'user'
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr_002',
    name: 'Alex Johnson',
    email: 'user@tas.com',
    password: 'user123',
    role: 'user',
    createdAt: '2026-02-10T08:30:00Z',
  },
  {
    id: 'usr_003',
    name: 'Maria Garcia',
    email: 'guest@tas.com',
    password: 'guest123',
    role: 'user',
    createdAt: '2026-03-05T14:00:00Z',
  },
];

/**
 * Seed shipments. Each shipment has:
 *  - id: Tracking ID (format: TAS-XXXXXXXX)
 *  - isPublic: if true, any logged-in user can view it
 *  - allowedUsers: array of user IDs that can view it if not public
 *  - status: one of 'processing' | 'in_transit' | 'customs' | 'out_for_delivery' | 'delivered'
 *  - logs: array of {timestamp, location, event, note}
 */
const SEED_SHIPMENTS = [
  {
    id: 'TAS-A1B2C3D4',
    isPublic: true,
    allowedUsers: [],
    status: 'in_transit',
    origin: 'Dubai, UAE',
    destination: 'London, UK',
    vessel: 'Emirates Flight EK-007',
    weight: '124 kg',
    dimensions: '80 × 60 × 50 cm',
    estimatedDelivery: '2026-05-28',
    recipient: 'Global Imports Ltd.',
    description: 'Electronic Components',
    logs: [
      { timestamp: '2026-05-20T08:00:00Z', location: 'Dubai, UAE', event: 'Order Processed', note: 'Shipment booked and label created.' },
      { timestamp: '2026-05-21T03:00:00Z', location: 'Dubai International Airport', event: 'In Transit', note: 'Package loaded onto Emirates EK-007.' },
      { timestamp: '2026-05-21T11:30:00Z', location: 'Over Europe (Airspace)', event: 'In Transit', note: 'Aircraft en-route to London Heathrow.' },
    ],
    createdAt: '2026-05-20T07:00:00Z',
    updatedAt: '2026-05-21T11:30:00Z',
  },
  {
    id: 'TAS-E5F6G7H8',
    isPublic: false,
    allowedUsers: ['usr_002'], // Only Alex Johnson can see this
    status: 'customs',
    origin: 'Shanghai, China',
    destination: 'New York, USA',
    vessel: 'MSC Cristina — Voyage 14W',
    weight: '2,400 kg',
    dimensions: '120 × 230 × 150 cm',
    estimatedDelivery: '2026-06-02',
    recipient: 'TechSource Inc.',
    description: 'Industrial Machinery Parts',
    logs: [
      { timestamp: '2026-05-10T09:00:00Z', location: 'Shanghai, China', event: 'Order Processed', note: 'Export documents prepared.' },
      { timestamp: '2026-05-12T06:00:00Z', location: 'Port of Shanghai', event: 'In Transit', note: 'Container loaded on MSC Cristina.' },
      { timestamp: '2026-05-19T14:00:00Z', location: 'Pacific Ocean', event: 'In Transit', note: 'Vessel crossed International Date Line.' },
      { timestamp: '2026-05-21T07:00:00Z', location: 'Port of Long Beach, USA', event: 'Customs Clearance', note: 'Cargo under US Customs inspection. Awaiting clearance.' },
    ],
    createdAt: '2026-05-10T08:00:00Z',
    updatedAt: '2026-05-21T07:00:00Z',
  },
  {
    id: 'TAS-I9J0K1L2',
    isPublic: false,
    allowedUsers: ['usr_003'], // Only Maria Garcia
    status: 'out_for_delivery',
    origin: 'Frankfurt, Germany',
    destination: 'Toronto, Canada',
    vessel: 'Lufthansa Cargo LH-8002',
    weight: '34 kg',
    dimensions: '40 × 30 × 25 cm',
    estimatedDelivery: '2026-05-22',
    recipient: 'Precision Optics Corp.',
    description: 'Medical Optical Equipment',
    logs: [
      { timestamp: '2026-05-18T10:00:00Z', location: 'Frankfurt, Germany', event: 'Order Processed', note: 'Cleared for air freight.' },
      { timestamp: '2026-05-19T04:00:00Z', location: 'Frankfurt Airport', event: 'In Transit', note: 'Loaded onto LH-8002.' },
      { timestamp: '2026-05-19T16:00:00Z', location: 'Toronto Pearson Airport', event: 'Customs Clearance', note: 'Customs cleared. Released.' },
      { timestamp: '2026-05-21T09:00:00Z', location: 'Toronto Distribution Hub', event: 'Out for Delivery', note: 'Out for final delivery to recipient.' },
    ],
    createdAt: '2026-05-18T09:00:00Z',
    updatedAt: '2026-05-21T09:00:00Z',
  },
  {
    id: 'TAS-M3N4O5P6',
    isPublic: true,
    allowedUsers: [],
    status: 'delivered',
    origin: 'Mumbai, India',
    destination: 'Singapore',
    vessel: 'Maersk Sealand — V.403S',
    weight: '780 kg',
    dimensions: '100 × 90 × 80 cm',
    estimatedDelivery: '2026-05-15',
    recipient: 'Asia Pacific Trade Co.',
    description: 'Textile Goods',
    logs: [
      { timestamp: '2026-05-08T07:00:00Z', location: 'Mumbai, India', event: 'Order Processed', note: 'Export packing completed.' },
      { timestamp: '2026-05-09T10:00:00Z', location: 'Nhava Sheva Port, Mumbai', event: 'In Transit', note: 'Container sealed and onboard Maersk Sealand.' },
      { timestamp: '2026-05-13T08:00:00Z', location: 'Strait of Malacca', event: 'In Transit', note: 'Vessel in Strait of Malacca.' },
      { timestamp: '2026-05-14T15:00:00Z', location: 'Port of Singapore', event: 'Customs Clearance', note: 'Cleared by Singapore Customs.' },
      { timestamp: '2026-05-15T11:00:00Z', location: 'Singapore', event: 'Delivered', note: 'Received and signed by recipient.' },
    ],
    createdAt: '2026-05-08T06:00:00Z',
    updatedAt: '2026-05-15T11:00:00Z',
  },
];

// ─── Storage Helpers ──────────────────────────────────────────────────────────

const USERS_KEY = 'tas_users';
const SHIPMENTS_KEY = 'tas_shipments';
const CURRENT_USER_KEY = 'tas_current_user';

/** Initialize localStorage with seed data if not already set */
function initDb() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  }
  if (!localStorage.getItem(SHIPMENTS_KEY)) {
    localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(SEED_SHIPMENTS));
  }
}

/** Get all users from storage */
function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}

/** Save users array to storage */
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Get all shipments from storage */
function getShipments() {
  return JSON.parse(localStorage.getItem(SHIPMENTS_KEY) || '[]');
}

/** Save shipments array to storage */
function saveShipments(shipments) {
  localStorage.setItem(SHIPMENTS_KEY, JSON.stringify(shipments));
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/** Authenticate a user by email + password. Returns user object or null. */
function authenticate(email, password) {
  const users = getUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (user) {
    const { password: _, ...safeUser } = user; // Strip password before storing session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safeUser));
    return safeUser;
  }
  return null;
}

/** Get current logged-in user from session storage */
function getCurrentUser() {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** Log out current user */
function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ─── Shipment Helpers ─────────────────────────────────────────────────────────

/** Generate a unique TAS tracking ID */
function generateTrackingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'TAS-';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure uniqueness
  const existing = getShipments().map((s) => s.id);
  if (existing.includes(result)) return generateTrackingId();
  return result;
}

/**
 * Check if a user has access to a specific shipment.
 * @param {string} userId - The user's ID
 * @param {object} shipment - The shipment object
 * @returns {boolean}
 */
function userHasAccess(userId, shipment) {
  if (shipment.isPublic) return true;
  return shipment.allowedUsers.includes(userId);
}

/** Get a shipment by tracking ID. Checks access for the given user. */
function getShipmentByTrackingId(trackingId, userId = null) {
  const shipments = getShipments();
  const shipment = shipments.find(
    (s) => s.id.toUpperCase() === trackingId.toUpperCase()
  );
  if (!shipment) return { found: false };
  if (userId && userHasAccess(userId, shipment)) return { found: true, access: true, shipment };
  if (!userId && shipment.isPublic) return { found: true, access: true, shipment };
  return { found: true, access: false, shipment: null };
}

/** Create a new shipment */
function createShipment(data) {
  const shipments = getShipments();
  const newShipment = {
    id: generateTrackingId(),
    isPublic: data.isPublic || false,
    allowedUsers: data.allowedUsers || [],
    status: data.status || 'processing',
    origin: data.origin || '',
    destination: data.destination || '',
    vessel: data.vessel || '',
    weight: data.weight || '',
    dimensions: data.dimensions || '',
    estimatedDelivery: data.estimatedDelivery || '',
    recipient: data.recipient || '',
    description: data.description || '',
    logs: [
      {
        timestamp: new Date().toISOString(),
        location: data.origin || '',
        event: 'Order Processed',
        note: 'Shipment created by TAS admin.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  shipments.push(newShipment);
  saveShipments(shipments);
  return newShipment;
}

/** Update an existing shipment by ID */
function updateShipment(trackingId, updates) {
  const shipments = getShipments();
  const idx = shipments.findIndex((s) => s.id === trackingId);
  if (idx === -1) return null;
  shipments[idx] = {
    ...shipments[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveShipments(shipments);
  return shipments[idx];
}

/** Add a log event to a shipment */
function addShipmentLog(trackingId, log) {
  const shipments = getShipments();
  const idx = shipments.findIndex((s) => s.id === trackingId);
  if (idx === -1) return null;
  shipments[idx].logs.push({ ...log, timestamp: new Date().toISOString() });
  shipments[idx].updatedAt = new Date().toISOString();
  saveShipments(shipments);
  return shipments[idx];
}

/** Delete a shipment by ID */
function deleteShipment(trackingId) {
  const shipments = getShipments().filter((s) => s.id !== trackingId);
  saveShipments(shipments);
}

// ─── RBAC Helpers ─────────────────────────────────────────────────────────────

/** Grant a user access to a shipment */
function grantAccess(userId, trackingId) {
  const shipments = getShipments();
  const idx = shipments.findIndex((s) => s.id === trackingId);
  if (idx === -1) return;
  if (!shipments[idx].allowedUsers.includes(userId)) {
    shipments[idx].allowedUsers.push(userId);
    shipments[idx].updatedAt = new Date().toISOString();
    saveShipments(shipments);
  }
}

/** Revoke a user's access to a shipment */
function revokeAccess(userId, trackingId) {
  const shipments = getShipments();
  const idx = shipments.findIndex((s) => s.id === trackingId);
  if (idx === -1) return;
  shipments[idx].allowedUsers = shipments[idx].allowedUsers.filter((id) => id !== userId);
  shipments[idx].updatedAt = new Date().toISOString();
  saveShipments(shipments);
}

/** Toggle isPublic for a shipment */
function setShipmentPublic(trackingId, isPublic) {
  updateShipment(trackingId, { isPublic });
}

// ─── Stats Helpers ────────────────────────────────────────────────────────────

/** Return overview stats for admin dashboard */
function getStats() {
  const shipments = getShipments();
  return {
    total: shipments.length,
    active: shipments.filter((s) => ['in_transit', 'customs', 'out_for_delivery'].includes(s.status)).length,
    delivered: shipments.filter((s) => s.status === 'delivered').length,
    processing: shipments.filter((s) => s.status === 'processing').length,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

const db = {
  initDb,
  getUsers,
  saveUsers,
  getShipments,
  saveShipments,
  authenticate,
  getCurrentUser,
  logout,
  generateTrackingId,
  userHasAccess,
  getShipmentByTrackingId,
  createShipment,
  updateShipment,
  addShipmentLog,
  deleteShipment,
  grantAccess,
  revokeAccess,
  setShipmentPublic,
  getStats,
};

export default db;
