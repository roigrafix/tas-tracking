/**
 * shipments routes — TAS Tracking Server
 * ========================================
 * GET    /api/shipments            — Admin: list all shipments
 * POST   /api/shipments            — Admin: create shipment
 * GET    /api/shipments/:id        — RBAC: get shipment + logs
 * PATCH  /api/shipments/:id        — Admin: update shipment
 * DELETE /api/shipments/:id        — Admin: delete shipment
 * POST   /api/shipments/:id/logs   — Admin: add log entry
 * GET    /api/shipments/:id/events — RBAC: Server-Sent Events stream
 * PATCH  /api/shipments/:id/public — Admin: toggle is_public flag
 * GET    /api/stats                — Admin: overview stats
 */

const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, run } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ── SSE client registry {shipmentId: [res, ...]} ─────────────────────────────
const sseClients = new Map();

function broadcastToShipment(shipmentId, eventName, data) {
  const clients = sseClients.get(shipmentId) || [];
  const payload  = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => { try { res.write(payload); } catch (_) {} });
}

// ── Tracking ID generator ─────────────────────────────────────────────────────
function generateTrackingId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'TAS-';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  // Ensure uniqueness
  if (queryOne('SELECT id FROM shipments WHERE id = ?', [id])) return generateTrackingId();
  return id;
}

// ── RBAC helper ───────────────────────────────────────────────────────────────
function userHasAccess(userId, role, shipment) {
  if (role === 'admin') return true;
  if (shipment.is_public) return true;
  const access = queryOne(
    'SELECT 1 FROM shipment_access WHERE user_id = ? AND shipment_id = ?',
    [userId, shipment.id]
  );
  return !!access;
}

// ── Shape helpers ─────────────────────────────────────────────────────────────
function withLogs(shipment) {
  if (!shipment) return null;
  const logs = query(
    'SELECT * FROM shipment_logs WHERE shipment_id = ? ORDER BY logged_at ASC',
    [shipment.id]
  );
  const allowedUsers = query(
    'SELECT user_id FROM shipment_access WHERE shipment_id = ?',
    [shipment.id]
  ).map((r) => r.user_id);
  return { ...shipment, is_public: Boolean(shipment.is_public), logs, allowedUsers };
}

// ── GET /api/stats ────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  const total     = queryOne('SELECT COUNT(*) AS n FROM shipments').n;
  const active    = queryOne(`SELECT COUNT(*) AS n FROM shipments WHERE status IN ('in_transit','customs','out_for_delivery')`).n;
  const delivered = queryOne(`SELECT COUNT(*) AS n FROM shipments WHERE status = 'delivered'`).n;
  const processing= queryOne(`SELECT COUNT(*) AS n FROM shipments WHERE status = 'processing'`).n;
  res.json({ total, active, delivered, processing });
});

// ── GET /api/shipments ────────────────────────────────────────────────────────
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const shipments = query('SELECT * FROM shipments ORDER BY created_at DESC');
  res.json(shipments.map(withLogs));
});

// ── POST /api/shipments ───────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const {
    description, status = 'processing', origin, destination,
    vessel, weight, dimensions, recipient, estimated_delivery,
    isPublic = false,
  } = req.body;

  if (!description) return res.status(400).json({ error: 'description is required.' });

  const id = generateTrackingId();
  run(
    `INSERT INTO shipments
       (id, description, status, origin, destination, vessel, weight, dimensions,
        recipient, estimated_delivery, is_public, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
    [id, description, status, origin, destination, vessel,
     weight, dimensions, recipient, estimated_delivery,
     isPublic ? 1 : 0, req.user.id]
  );

  // Auto-create first log
  run(
    `INSERT INTO shipment_logs (id, shipment_id, event, location, note, logged_at)
     VALUES (?, ?, 'Order Processed', ?, 'Shipment created by TAS admin.', datetime('now'))`,
    [uuidv4(), id, origin || '']
  );

  const shipment = withLogs(queryOne('SELECT * FROM shipments WHERE id = ?', [id]));
  res.status(201).json(shipment);
});

// ── GET /api/shipments/:id ────────────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const shipment = queryOne('SELECT * FROM shipments WHERE id = ?', [req.params.id.toUpperCase()]);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

  if (!userHasAccess(req.user.id, req.user.role, shipment)) {
    return res.status(403).json({ error: 'Access denied to this shipment.' });
  }

  res.json(withLogs(shipment));
});

// ── PATCH /api/shipments/:id ──────────────────────────────────────────────────
router.patch('/:id', requireAuth, requireAdmin, (req, res) => {
  const { status, vessel, estimated_delivery, description, origin, destination, weight, dimensions, recipient } = req.body;
  const id = req.params.id.toUpperCase();

  const existing = queryOne('SELECT * FROM shipments WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Shipment not found.' });

  run(
    `UPDATE shipments SET
       status = COALESCE(?, status),
       vessel = COALESCE(?, vessel),
       estimated_delivery = COALESCE(?, estimated_delivery),
       description = COALESCE(?, description),
       origin = COALESCE(?, origin),
       destination = COALESCE(?, destination),
       weight = COALESCE(?, weight),
       dimensions = COALESCE(?, dimensions),
       recipient = COALESCE(?, recipient),
       updated_at = datetime('now')
     WHERE id = ?`,
    [status, vessel, estimated_delivery, description, origin, destination, weight, dimensions, recipient, id]
  );

  const updated = withLogs(queryOne('SELECT * FROM shipments WHERE id = ?', [id]));

  // Broadcast real-time update to SSE subscribers
  broadcastToShipment(id, 'status_update', {
    status: updated.status,
    updatedAt: updated.updated_at,
  });

  res.json(updated);
});

// ── DELETE /api/shipments/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = req.params.id.toUpperCase();
  const existing = queryOne('SELECT id FROM shipments WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Shipment not found.' });

  run('DELETE FROM shipments WHERE id = ?', [id]);

  // Close SSE clients for deleted shipment
  broadcastToShipment(id, 'deleted', { id });
  sseClients.delete(id);

  res.json({ message: `Shipment ${id} deleted.` });
});

// ── POST /api/shipments/:id/logs ──────────────────────────────────────────────
router.post('/:id/logs', requireAuth, requireAdmin, (req, res) => {
  const { event, location, note } = req.body;
  const id = req.params.id.toUpperCase();

  if (!event) return res.status(400).json({ error: 'event is required.' });

  const existing = queryOne('SELECT id FROM shipments WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Shipment not found.' });

  const logId = uuidv4();
  run(
    `INSERT INTO shipment_logs (id, shipment_id, event, location, note, logged_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [logId, id, event, location || '', note || '']
  );

  // Update shipment updated_at
  run(`UPDATE shipments SET updated_at = datetime('now') WHERE id = ?`, [id]);

  const log = queryOne('SELECT * FROM shipment_logs WHERE id = ?', [logId]);

  // Broadcast to SSE clients
  broadcastToShipment(id, 'log_added', log);

  res.status(201).json(log);
});

// ── PATCH /api/shipments/:id/public ──────────────────────────────────────────
router.patch('/:id/public', requireAuth, requireAdmin, (req, res) => {
  const { isPublic } = req.body;
  const id = req.params.id.toUpperCase();

  const existing = queryOne('SELECT id FROM shipments WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Shipment not found.' });

  run(
    `UPDATE shipments SET is_public = ?, updated_at = datetime('now') WHERE id = ?`,
    [isPublic ? 1 : 0, id]
  );

  res.json({ id, isPublic: Boolean(isPublic) });
});

// ── GET /api/shipments/:id/events (SSE) ──────────────────────────────────────
router.get('/:id/events', requireAuth, (req, res) => {
  const id = req.params.id.toUpperCase();
  const shipment = queryOne('SELECT * FROM shipments WHERE id = ?', [id]);
  if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

  if (!userHasAccess(req.user.id, req.user.role, shipment)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ shipmentId: id })}\n\n`);

  // Register client
  const clients = sseClients.get(id) || [];
  clients.push(res);
  sseClients.set(id, clients);

  // Send keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) {}
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    const remaining = (sseClients.get(id) || []).filter((c) => c !== res);
    if (remaining.length > 0) {
      sseClients.set(id, remaining);
    } else {
      sseClients.delete(id);
    }
  });
});

module.exports = router;
