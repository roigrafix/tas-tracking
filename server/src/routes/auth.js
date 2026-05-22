/**
 * auth routes — TAS Tracking Server
 * ===================================
 * POST /api/auth/login    — email + password + captchaToken
 * POST /api/auth/logout   — revoke refresh token
 * POST /api/auth/refresh  — issue new access token via refresh cookie
 * POST /api/auth/forgot   — mock password reset email
 */

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const { queryOne, run }             = require('../db/database');
const { verifyRecaptcha }           = require('../middleware/recaptcha');
const {
  generateAccessToken, generateRefreshToken,
  verifyRefreshToken, revokeRefreshToken,
  setRefreshCookie, clearRefreshCookie,
} = require('../utils/jwt');

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', verifyRecaptcha, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = queryOne(
    'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?',
    [email.trim().toLowerCase()]
  );

  if (!user || !user.is_active) {
    // Use same message to prevent user enumeration
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id);

  setRefreshCookie(res, refreshToken);

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
  });
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided.' });
  }

  const userId = verifyRefreshToken(token);
  if (!userId) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token. Please sign in again.' });
  }

  const user = queryOne(
    'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
    [userId]
  );

  if (!user || !user.is_active) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Account not found.' });
  }

  // Rotate: revoke old, issue new
  revokeRefreshToken(token);
  const newRefreshToken = generateRefreshToken(user.id);
  const accessToken     = generateAccessToken(user);

  setRefreshCookie(res, newRefreshToken);

  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
  });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) revokeRefreshToken(token);
  clearRefreshCookie(res);
  res.json({ message: 'Signed out successfully.' });
});

// ── POST /api/auth/forgot ────────────────────────────────────────────────────
router.post('/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  // Always return success to prevent user enumeration
  // In production: send a real password reset email with a time-limited token
  const user = queryOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (user) {
    console.log(`[AUTH] Password reset requested for ${email} (would send email in production)`);
  }

  res.json({ message: 'If that account exists, a password reset link has been sent.' });
});

module.exports = router;
