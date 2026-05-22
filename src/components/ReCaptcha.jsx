/**
 * ReCaptcha.jsx — TAS Tracking Application
 * ==========================================
 * Wraps the real Google reCAPTCHA v2 (react-google-recaptcha).
 *
 * ── PRODUCTION SETUP ─────────────────────────────────────────────────────────
 * 1. Register your domain at https://www.google.com/recaptcha/admin/create
 *    - Choose "reCAPTCHA v2 → I'm not a robot checkbox"
 *    - Add your domains (e.g. tas.com, localhost)
 * 2. Copy your Site Key into the VITE_RECAPTCHA_SITE_KEY env variable:
 *      Create a `.env` file in the project root:
 *        VITE_RECAPTCHA_SITE_KEY=your_actual_site_key_here
 * 3. Verify the token SERVER-SIDE on every form submission:
 *      POST https://www.google.com/recaptcha/api/siteverify
 *      Body: secret=YOUR_SECRET_KEY&response=TOKEN_FROM_CLIENT
 *
 * ── CURRENT KEY ──────────────────────────────────────────────────────────────
 * The fallback below uses Google's official TEST key:
 *   6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
 * It ALWAYS passes locally — replace it with your real key for production.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import ReCAPTCHAWidget from 'react-google-recaptcha';

/**
 * Site key resolution:
 *  1. Environment variable VITE_RECAPTCHA_SITE_KEY (production key)
 *  2. Google's official test key as fallback (always passes, never use in prod)
 */
const SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY ||
  '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

/**
 * @param {function} onVerify  - Called with the token string when verified, or null on expiry/error
 * @param {function} onExpire  - Called when the reCAPTCHA response expires
 * @param {string}   theme     - 'dark' | 'light' (default: 'dark')
 * @param {object}   ref       - Optional forwarded ref to call .reset() on the widget
 */
export default function ReCaptcha({ onVerify, onExpire, theme = 'dark' }) {
  const handleChange = (token) => {
    // token is a string when verified, null when expired
    if (token) {
      onVerify && onVerify(token);
    } else {
      onVerify && onVerify(null);
      onExpire && onExpire();
    }
  };

  const handleExpired = () => {
    onVerify && onVerify(null);
    onExpire && onExpire();
  };

  const handleError = () => {
    // Network or configuration error — treat as unverified
    onVerify && onVerify(null);
  };

  return (
    <div className="recaptcha-real-wrap">
      <ReCAPTCHAWidget
        sitekey={SITE_KEY}
        theme={theme}
        onChange={handleChange}
        onExpired={handleExpired}
        onErrored={handleError}
      />

      {/* Inform developers which key is active */}
      {!import.meta.env.VITE_RECAPTCHA_SITE_KEY && (
        <div className="recaptcha-dev-notice">
          🧪 Using Google's test key — set <code>VITE_RECAPTCHA_SITE_KEY</code> in <code>.env</code> for production
        </div>
      )}

      <style>{`
        .recaptcha-real-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Ensure the reCAPTCHA iframe fits within the card on small screens */
        .recaptcha-real-wrap iframe {
          max-width: 100%;
        }

        .recaptcha-dev-notice {
          font-size: 0.7rem;
          color: #78716c;
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 6px;
          padding: 0.375rem 0.75rem;
          line-height: 1.5;
        }

        .recaptcha-dev-notice code {
          font-family: monospace;
          color: #fcd34d;
          font-size: 0.68rem;
        }
      `}</style>
    </div>
  );
}
