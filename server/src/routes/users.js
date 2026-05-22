/**
 * users routes — TAS Tracking Server
 * =====================================
 * GET /api/users — Admin: list all users (without password hashes)
 */

const router = require('express').Router();
const { query } = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const users = query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at ASC'
  );
  // Never return password_hash
  res.json(users.map((u) => ({ ...u, is_active: Boolean(u.is_active) })));
});

module.exports = router;
