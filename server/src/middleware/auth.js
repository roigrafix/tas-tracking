/**
 * auth.js (middleware) — TAS Tracking Server
 * =============================================
 * JWT Bearer token verification middleware.
 * Attaches decoded user payload to req.user.
 */

const { verifyAccessToken } = require('../utils/jwt');
const { queryOne } = require('../db/database');

/**
 * requireAuth — Verifies the Bearer token and loads the user.
 * Returns 401 if missing or invalid.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Also accept token from query param for SSE (EventSource can't set headers)
  const queryToken = req.query?.token;

  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  try {
    const payload = verifyAccessToken(token);

    // Optionally re-verify user still exists and is active
    const user = queryOne(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [payload.sub]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please refresh your token.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * requireAdmin — Middleware that must come AFTER requireAuth.
 * Returns 403 if the user is not an admin.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * optionalAuth — Attaches req.user if a valid Bearer token is present,
 * but does NOT reject the request if missing (for public endpoints).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = queryOne(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [payload.sub]
    );
    req.user = (user && user.is_active) ? user : null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
