/**
 * jwt.js — TAS Tracking Server
 * ==============================
 * JWT token generation, verification, and refresh token management.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { run, queryOne } = require('../db/database');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXP     = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ── Token Generation ──────────────────────────────────────────────────────────

/** Generate a short-lived access token (15 min default) */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXP }
  );
}

/** Generate a long-lived refresh token (7 days default), store hash in DB */
function generateRefreshToken(userId) {
  const token = jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXP });

  // Store a SHA-256 hash (never store raw tokens)
  const hash      = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  run(
    `INSERT OR REPLACE INTO refresh_tokens (token_hash, user_id, expires_at, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [hash, userId, expiresAt]
  );

  return token;
}

// ── Token Verification ────────────────────────────────────────────────────────

/** Verify an access token. Returns payload or throws. */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/** Verify a refresh token, check it exists in DB (not revoked). Returns userId or null. */
function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    const hash    = crypto.createHash('sha256').update(token).digest('hex');
    const stored  = queryOne(
      `SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ? AND expires_at > datetime('now')`,
      [hash, payload.sub]
    );
    return stored ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Revoke a refresh token (on logout) */
function revokeRefreshToken(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  run('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
}

/** Revoke all refresh tokens for a user (e.g. password change) */
function revokeAllUserTokens(userId) {
  run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
}

/** Set the refresh token as an httpOnly cookie */
function setRefreshCookie(res, token) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path:     '/api/auth',
  });
}

/** Clear the refresh cookie */
function clearRefreshCookie(res) {
  res.clearCookie('refresh_token', { path: '/api/auth' });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setRefreshCookie,
  clearRefreshCookie,
};
