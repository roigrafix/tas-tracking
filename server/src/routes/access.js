/**
 * access routes — TAS Tracking Server
 * =====================================
 * GET  /api/access         — Admin: all access entries with user + shipment info
 * POST /api/access/grant   — Admin: grant user access to a shipment
 * POST /api/access/revoke  — Admin: revoke user access from a shipment
 */

const router = require('express').Router();
const { query, queryOne, run } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ── GET /api/access ───────────────────────────────────────────────────────────
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const rows = query(`
    SELECT
      sa.user_id, sa.shipment_id, sa.granted_at,
      u.name  AS user_name, u.email AS user_email,
      s.description AS shipment_desc, s.status AS shipment_status,
      s.is_public
    FROM shipment_access sa
    JOIN users     u ON u.id = sa.user_id
    JOIN shipments s ON s.id = sa.shipment_id
    ORDER BY sa.granted_at DESC
  `);
  res.json(rows);
});

// ── POST /api/access/grant ────────────────────────────────────────────────────
router.post('/grant', requireAuth, requireAdmin, (req, res) => {
  const { userId, shipmentId } = req.body;
  if (!userId || !shipmentId) {
    return res.status(400).json({ error: 'userId and shipmentId are required.' });
  }

  const user     = queryOne('SELECT id FROM users WHERE id = ?', [userId]);
  const shipment = queryOne('SELECT id FROM shipments WHERE id = ?', [shipmentId.toUpperCase()]);

  if (!user)     return res.status(404).json({ error: 'User not found.' });
  if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

  run(
    `INSERT OR IGNORE INTO shipment_access (user_id, shipment_id, granted_by, granted_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [userId, shipmentId.toUpperCase(), req.user.id]
  );

  res.json({ message: 'Access granted.', userId, shipmentId: shipmentId.toUpperCase() });
});

// ── POST /api/access/revoke ───────────────────────────────────────────────────
router.post('/revoke', requireAuth, requireAdmin, (req, res) => {
  const { userId, shipmentId } = req.body;
  if (!userId || !shipmentId) {
    return res.status(400).json({ error: 'userId and shipmentId are required.' });
  }

  run(
    'DELETE FROM shipment_access WHERE user_id = ? AND shipment_id = ?',
    [userId, shipmentId.toUpperCase()]
  );

  res.json({ message: 'Access revoked.', userId, shipmentId: shipmentId.toUpperCase() });
});

module.exports = router;
