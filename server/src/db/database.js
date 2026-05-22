/**
 * database.js — TAS Tracking Server
 * ====================================
 * sql.js-powered SQLite database.
 * The DB is kept in memory during the process and persisted to a file on every write.
 *
 * Schema:
 *   users           — id, name, email, password_hash, role, is_active, created_at
 *   shipments       — id, description, status, origin, destination, vessel,
 *                     weight, dimensions, recipient, estimated_delivery,
 *                     is_public, created_by, created_at, updated_at
 *   shipment_logs   — id, shipment_id, event, location, note, logged_at
 *   shipment_access — user_id, shipment_id, granted_by, granted_at
 *   refresh_tokens  — token_hash, user_id, expires_at, created_at
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(process.env.DB_PATH || './data/tas.db');

let db = null; // sql.js Database instance

// ── Schema DDL ────────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipments (
  id                 TEXT PRIMARY KEY,
  description        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'processing'
                     CHECK(status IN ('processing','in_transit','customs','out_for_delivery','delivered')),
  origin             TEXT,
  destination        TEXT,
  vessel             TEXT,
  weight             TEXT,
  dimensions         TEXT,
  recipient          TEXT,
  estimated_delivery TEXT,
  is_public          INTEGER NOT NULL DEFAULT 0,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipment_logs (
  id          TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  location    TEXT,
  note        TEXT,
  logged_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_shipment ON shipment_logs(shipment_id);

CREATE TABLE IF NOT EXISTS shipment_access (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  granted_by  TEXT REFERENCES users(id),
  granted_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, shipment_id)
);
CREATE INDEX IF NOT EXISTS idx_access_user     ON shipment_access(user_id);
CREATE INDEX IF NOT EXISTS idx_access_shipment ON shipment_access(shipment_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// ── Persistence ───────────────────────────────────────────────────────────────

/** Save the in-memory DB to disk */
function persist() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initDb() {
  const SQL = await initSqlJs();

  // Load from disk if file exists, otherwise create fresh
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log(`[DB] Loaded existing database from ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new in-memory database');
  }

  db.run(SCHEMA);
  persist(); // Ensure file exists immediately
  return db;
}

// ── Query Helpers ─────────────────────────────────────────────────────────────

/** Run a SELECT and return array of row objects */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** Run a SELECT and return first row or null */
function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] ?? null;
}

/** Run an INSERT/UPDATE/DELETE and persist to disk */
function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

/** Return the last inserted rowid (as string for TEXT PKs, use UUID instead) */
function getDb() { return db; }

module.exports = { initDb, query, queryOne, run, persist, getDb };
