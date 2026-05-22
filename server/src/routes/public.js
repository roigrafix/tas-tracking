/**
 * public routes — TAS Tracking Server
 * =====================================
 * POST /api/public/track  — reCAPTCHA-gated public shipment lookup (no auth)
 *
 * Only returns shipments where is_public = 1.
 * Restricted shipments get a "found but restricted" response (no details).
 */

const router = require('express').Router();
const { queryOne, query } = require('../db/database');
const { verifyRecaptcha } = require('../middleware/recaptcha');

// ── POST /api/public/track ───────────────────────────────────────────────────
router.post('/track', verifyRecaptcha, (req, res) => {
  const { trackingId } = req.body;

  if (!trackingId || typeof trackingId !== 'string') {
    return res.status(400).json({ error: 'trackingId is required.' });
  }

  const id = trackingId.trim().toUpperCase();

  // Find the shipment (regardless of public flag first)
  const shipment = queryOne('SELECT * FROM shipments WHERE id = ?', [id]);

  if (!shipment) {
    return res.json({ found: false });
  }

  if (!shipment.is_public) {
    // Exists but restricted — tell client it exists without revealing details
    return res.json({ found: true, access: false });
  }

  // Public shipment — return full details with logs
  const logs = query(
    'SELECT * FROM shipment_logs WHERE shipment_id = ? ORDER BY logged_at ASC',
    [id]
  );

  res.json({
    found:    true,
    access:   true,
    shipment: { ...shipment, is_public: Boolean(shipment.is_public), logs },
  });
});

module.exports = router;
