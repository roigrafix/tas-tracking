/**
 * recaptcha.js (middleware) — TAS Tracking Server
 * =================================================
 * Server-side reCAPTCHA v2 token verification.
 * Calls Google's siteverify API with the secret key.
 *
 * Usage:
 *   router.post('/track', verifyRecaptcha, handler);
 *
 * The client must send: { captchaToken: "..." } in the request body.
 */

const fetch = require('node-fetch');

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * verifyRecaptcha middleware
 * Reads captchaToken from req.body, verifies with Google, returns 400 on failure.
 */
async function verifyRecaptcha(req, res, next) {
  const token = req.body?.captchaToken;

  if (!token) {
    return res.status(400).json({ error: 'reCAPTCHA token is required.' });
  }

  // ── Development bypass ───────────────────────────────────────────────────
  // Set RECAPTCHA_SKIP_VERIFY=true in server/.env to bypass for local testing.
  // NEVER enable this in production.
  if (process.env.RECAPTCHA_SKIP_VERIFY === 'true') {
    console.warn('[reCAPTCHA] ⚠️  Verification SKIPPED (RECAPTCHA_SKIP_VERIFY=true). Development only!');
    req.recaptcha = { success: true, skipped: true };
    return next();
  }

  try {
    const params = new URLSearchParams({
      secret:   RECAPTCHA_SECRET,
      response: token,
      remoteip: req.ip,
    });

    const response = await fetch(`${VERIFY_URL}?${params.toString()}`, { method: 'POST' });
    const data     = await response.json();

    if (!data.success) {
      console.warn('[reCAPTCHA] Verification failed:', data['error-codes']);
      return res.status(400).json({
        error: 'reCAPTCHA verification failed. Please try again.',
        codes: data['error-codes'],
      });
    }

    // Attach score info for logging (v2 doesn't have score, but good practice)
    req.recaptcha = { success: true, hostname: data.hostname };
    next();
  } catch (err) {
    console.error('[reCAPTCHA] Network error during verification:', err.message);
    // On network errors, fail open (allow) — adjust to fail closed in production if needed
    req.recaptcha = { success: false, error: err.message };
    next();
  }
}

module.exports = { verifyRecaptcha };
