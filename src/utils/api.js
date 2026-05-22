/**
 * api.js — TAS Tracking Frontend
 * =================================
 * Centralized API client that replaces mockDb.js.
 *
 * Features:
 *  - Automatically attaches JWT Bearer token to all requests
 *  - Silently refreshes access token on 401 (TOKEN_EXPIRED)
 *  - Stores access token in module memory (not localStorage) for security
 *  - Throws ApiError with { status, message } on failures
 */

const BASE = '/api';

// ── Module-level token store (in-memory only, never persisted) ────────────────
let _accessToken = null;
let _onSessionExpired = null; // Callback to trigger re-login UI

export function setAccessToken(token) { _accessToken = token; }
export function getAccessToken()      { return _accessToken; }
export function clearAccessToken()    { _accessToken = null; }

/** Register a callback to be called when the session is fully expired */
export function onSessionExpired(cb) { _onSessionExpired = cb; }

// ── Custom Error ──────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name   = 'ApiError';
  }
}

// ── Core Fetch Wrapper ────────────────────────────────────────────────────────

let _isRefreshing = false;
let _refreshQueue = []; // Pending requests waiting for refresh

async function fetchApi(path, options = {}, _retry = false) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(BASE + path, {
    ...options,
    headers,
    credentials: 'include', // Send httpOnly refresh cookie
  });

  // Handle 401 — try to refresh token
  if (res.status === 401 && !_retry) {
    if (_isRefreshing) {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject, path, options });
      });
    }

    _isRefreshing = true;
    try {
      const refreshed = await auth.refresh();
      _isRefreshing = false;

      // Retry queued requests
      _refreshQueue.forEach(({ resolve, reject, path: p, options: o }) => {
        fetchApi(p, o, true).then(resolve).catch(reject);
      });
      _refreshQueue = [];

      if (refreshed) {
        return fetchApi(path, options, true);
      }
    } catch {
      _isRefreshing = false;
      _refreshQueue = [];
    }

    // Refresh failed — session expired
    clearAccessToken();
    if (_onSessionExpired) _onSessionExpired();
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  // Parse response
  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && data.error) ? data.error : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data;
}

// Helper methods
const get  = (path, opts = {}) => fetchApi(path, { ...opts, method: 'GET' });
const post = (path, body, opts = {}) => fetchApi(path, { ...opts, method: 'POST',   body: JSON.stringify(body) });
const patch= (path, body, opts = {}) => fetchApi(path, { ...opts, method: 'PATCH',  body: JSON.stringify(body) });
const del  = (path, opts = {})       => fetchApi(path, { ...opts, method: 'DELETE' });

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  /** Login with email, password, and reCAPTCHA token. Returns { user, accessToken }. */
  async login(email, password, captchaToken) {
    const data = await post('/auth/login', { email, password, captchaToken });
    setAccessToken(data.accessToken);
    return data;
  },

  /** Refresh the access token using the httpOnly refresh cookie. */
  async refresh() {
    try {
      const data = await post('/auth/refresh', {});
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        return data;
      }
      return null;
    } catch {
      clearAccessToken();
      return null;
    }
  },

  /** Sign out — clears token and refresh cookie server-side. */
  async logout() {
    try { await post('/auth/logout', {}); } catch (_) {}
    clearAccessToken();
  },

  /** Request a password reset email. */
  async forgotPassword(email) {
    return post('/auth/forgot', { email });
  },
};

// ── Public Tracking (no auth) ─────────────────────────────────────────────────
export const publicApi = {
  /** Track a public shipment. Requires reCAPTCHA token. */
  async track(trackingId, captchaToken) {
    return post('/public/track', { trackingId, captchaToken });
  },
};

// ── Shipments ─────────────────────────────────────────────────────────────────
export const shipments = {
  /** List all shipments (admin only). */
  list: () => get('/shipments'),

  /** Get a single shipment by tracking ID (RBAC enforced). */
  get: (id) => get(`/shipments/${id}`),

  /** Create a new shipment (admin only). */
  create: (data) => post('/shipments', data),

  /** Update shipment details/status (admin only). */
  update: (id, data) => patch(`/shipments/${id}`, data),

  /** Delete a shipment (admin only). */
  delete: (id) => del(`/shipments/${id}`),

  /** Add a log entry to a shipment (admin only). */
  addLog: (id, data) => post(`/shipments/${id}/logs`, data),

  /** Toggle public/private flag (admin only). */
  setPublic: (id, isPublic) => patch(`/shipments/${id}/public`, { isPublic }),

  /**
   * Subscribe to real-time SSE updates for a shipment.
   * Returns an EventSource. Caller is responsible for closing it.
   *
   * @param {string}   id        Tracking ID
   * @param {function} onStatus  Called on 'status_update' events
   * @param {function} onLog     Called on 'log_added' events
   * @returns {EventSource}
   */
  subscribe(id, { onStatus, onLog, onConnected, onError } = {}) {
    // SSE requires the token in the URL since EventSource can't set headers
    const url = `${BASE}/shipments/${id}/events?token=${encodeURIComponent(_accessToken || '')}`;
    const es  = new EventSource(url);

    es.addEventListener('connected',     (e) => onConnected && onConnected(JSON.parse(e.data)));
    es.addEventListener('status_update', (e) => onStatus    && onStatus(JSON.parse(e.data)));
    es.addEventListener('log_added',     (e) => onLog       && onLog(JSON.parse(e.data)));
    es.onerror = (err) => { onError && onError(err); };

    return es;
  },
};

// ── Access Control (RBAC) ─────────────────────────────────────────────────────
export const access = {
  /** Get all access grants (admin only). */
  list: () => get('/access'),

  /** Grant a user access to a shipment (admin only). */
  grant: (userId, shipmentId) => post('/access/grant', { userId, shipmentId }),

  /** Revoke a user's access to a shipment (admin only). */
  revoke: (userId, shipmentId) => post('/access/revoke', { userId, shipmentId }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  /** List all users (admin only). */
  list: () => get('/users'),
};

// ── Stats ─────────────────────────────────────────────────────────────────────
export const stats = {
  /** Get dashboard stats (admin only). */
  get: () => get('/shipments/stats'),
};

// ── SSE Token Auth Middleware note ───────────────────────────────────────────
// The backend shipments/:id/events route needs to accept the token from query param.
// Update auth middleware to also check req.query.token for SSE routes.
