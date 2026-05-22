/**
 * seed.js — TAS Tracking Server
 * ================================
 * Seeds the database with demo users and shipments.
 * Safe to run multiple times — uses INSERT OR IGNORE.
 *
 * Run: node src/db/seed.js
 *      (or automatically on first server start when DB is empty)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDb, run, queryOne } = require('./database');

// ── Seed Data ─────────────────────────────────────────────────────────────────

const USERS = [
  { id: 'usr_admin_001', name: 'TAS Administrator', email: 'admin@tas.com', password: 'admin123', role: 'admin' },
  { id: 'usr_002',       name: 'Alex Johnson',      email: 'user@tas.com',  password: 'user123',  role: 'user' },
  { id: 'usr_003',       name: 'Maria Garcia',      email: 'guest@tas.com', password: 'guest123', role: 'user' },
];

const SHIPMENTS = [
  {
    id: 'TAS-A1B2C3D4', description: 'Electronic Components',
    status: 'in_transit', origin: 'Dubai, UAE', destination: 'London, UK',
    vessel: 'Emirates Flight EK-007', weight: '124 kg', dimensions: '80 × 60 × 50 cm',
    estimated_delivery: '2026-05-28', recipient: 'Global Imports Ltd.', is_public: 1,
    created_by: 'usr_admin_001',
    logs: [
      { event: 'Order Processed', location: 'Dubai, UAE', note: 'Shipment booked and label created.', logged_at: '2026-05-20T08:00:00' },
      { event: 'In Transit',      location: 'Dubai International Airport', note: 'Package loaded onto Emirates EK-007.', logged_at: '2026-05-21T03:00:00' },
      { event: 'In Transit',      location: 'European Airspace', note: 'Aircraft en-route to London Heathrow.', logged_at: '2026-05-21T11:30:00' },
    ],
  },
  {
    id: 'TAS-E5F6G7H8', description: 'Industrial Machinery Parts',
    status: 'customs', origin: 'Shanghai, China', destination: 'New York, USA',
    vessel: 'MSC Cristina — Voyage 14W', weight: '2,400 kg', dimensions: '120 × 230 × 150 cm',
    estimated_delivery: '2026-06-02', recipient: 'TechSource Inc.', is_public: 0,
    created_by: 'usr_admin_001',
    access: ['usr_002'],
    logs: [
      { event: 'Order Processed',   location: 'Shanghai, China', note: 'Export documents prepared.', logged_at: '2026-05-10T09:00:00' },
      { event: 'In Transit',        location: 'Port of Shanghai', note: 'Container loaded on MSC Cristina.', logged_at: '2026-05-12T06:00:00' },
      { event: 'In Transit',        location: 'Pacific Ocean', note: 'Vessel crossed International Date Line.', logged_at: '2026-05-19T14:00:00' },
      { event: 'Customs Clearance', location: 'Port of Long Beach, USA', note: 'Cargo under US Customs inspection.', logged_at: '2026-05-21T07:00:00' },
    ],
  },
  {
    id: 'TAS-I9J0K1L2', description: 'Medical Optical Equipment',
    status: 'out_for_delivery', origin: 'Frankfurt, Germany', destination: 'Toronto, Canada',
    vessel: 'Lufthansa Cargo LH-8002', weight: '34 kg', dimensions: '40 × 30 × 25 cm',
    estimated_delivery: '2026-05-22', recipient: 'Precision Optics Corp.', is_public: 0,
    created_by: 'usr_admin_001',
    access: ['usr_003'],
    logs: [
      { event: 'Order Processed',   location: 'Frankfurt, Germany', note: 'Cleared for air freight.', logged_at: '2026-05-18T10:00:00' },
      { event: 'In Transit',        location: 'Frankfurt Airport', note: 'Loaded onto LH-8002.', logged_at: '2026-05-19T04:00:00' },
      { event: 'Customs Clearance', location: 'Toronto Pearson Airport', note: 'Cleared. Released.', logged_at: '2026-05-19T16:00:00' },
      { event: 'Out for Delivery',  location: 'Toronto Distribution Hub', note: 'Out for final delivery.', logged_at: '2026-05-21T09:00:00' },
    ],
  },
  {
    id: 'TAS-M3N4O5P6', description: 'Textile Goods',
    status: 'delivered', origin: 'Mumbai, India', destination: 'Singapore',
    vessel: 'Maersk Sealand — V.403S', weight: '780 kg', dimensions: '100 × 90 × 80 cm',
    estimated_delivery: '2026-05-15', recipient: 'Asia Pacific Trade Co.', is_public: 1,
    created_by: 'usr_admin_001',
    logs: [
      { event: 'Order Processed',   location: 'Mumbai, India', note: 'Export packing completed.', logged_at: '2026-05-08T07:00:00' },
      { event: 'In Transit',        location: 'Nhava Sheva Port, Mumbai', note: 'Container sealed and onboard Maersk Sealand.', logged_at: '2026-05-09T10:00:00' },
      { event: 'In Transit',        location: 'Strait of Malacca', note: 'Vessel in Strait of Malacca.', logged_at: '2026-05-13T08:00:00' },
      { event: 'Customs Clearance', location: 'Port of Singapore', note: 'Cleared by Singapore Customs.', logged_at: '2026-05-14T15:00:00' },
      { event: 'Delivered',         location: 'Singapore', note: 'Received and signed by recipient.', logged_at: '2026-05-15T11:00:00' },
    ],
  },
];

// ── Seeder ────────────────────────────────────────────────────────────────────

async function seed() {
  await initDb();
  console.log('[SEED] Starting database seed...');

  // Seed users
  for (const u of USERS) {
    const exists = queryOne('SELECT id FROM users WHERE id = ?', [u.id]);
    if (!exists) {
      const hash = await bcrypt.hash(u.password, 12);
      run(
        `INSERT OR IGNORE INTO users (id, name, email, password_hash, role, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [u.id, u.name, u.email, hash, u.role]
      );
      console.log(`[SEED] Created user: ${u.email} (${u.role})`);
    }
  }

  // Seed shipments
  for (const s of SHIPMENTS) {
    const exists = queryOne('SELECT id FROM shipments WHERE id = ?', [s.id]);
    if (!exists) {
      run(
        `INSERT OR IGNORE INTO shipments
           (id, description, status, origin, destination, vessel, weight, dimensions,
            recipient, estimated_delivery, is_public, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [s.id, s.description, s.status, s.origin, s.destination,
         s.vessel, s.weight, s.dimensions, s.recipient,
         s.estimated_delivery, s.is_public, s.created_by]
      );

      // Seed logs
      for (const log of (s.logs || [])) {
        run(
          `INSERT INTO shipment_logs (id, shipment_id, event, location, note, logged_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), s.id, log.event, log.location, log.note, log.logged_at]
        );
      }

      // Seed access
      for (const userId of (s.access || [])) {
        run(
          `INSERT OR IGNORE INTO shipment_access (user_id, shipment_id, granted_by, granted_at)
           VALUES (?, ?, ?, datetime('now'))`,
          [userId, s.id, 'usr_admin_001']
        );
      }

      console.log(`[SEED] Created shipment: ${s.id} (${s.status})`);
    }
  }

  console.log('[SEED] ✅ Database seeded successfully!');
}

// Allow direct execution
if (require.main === module) {
  seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { seed };
