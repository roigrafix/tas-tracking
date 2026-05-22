# TAS Tracking — Backend Architecture & API Design

This document outlines a production-ready backend architecture for the TAS cargo tracking platform, including database schema, REST API endpoints, real-time update strategy, and push notification integration.

---

## Technology Recommendations

| Layer              | Technology                                 |
|--------------------|--------------------------------------------|
| Runtime            | Node.js 20+ (LTS)                          |
| Framework          | Express.js or Fastify                      |
| Primary Database   | PostgreSQL 16 (relational, RBAC-friendly)  |
| Cache / Real-time  | Redis + Socket.IO or Server-Sent Events    |
| Auth               | JWT (access token) + Refresh Token         |
| Push Notifications | Web Push API + Firebase Cloud Messaging    |
| File Storage       | AWS S3 / Google Cloud Storage              |
| Deployment         | Docker + Kubernetes or Firebase App Hosting|

---

## Database Schema (PostgreSQL)

### `users`
```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,           -- bcrypt hashed
  role         VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `shipments`
```sql
CREATE TABLE shipments (
  id                  VARCHAR(14) PRIMARY KEY,  -- e.g. TAS-A1B2C3D4
  description         TEXT NOT NULL,
  status              VARCHAR(30) NOT NULL CHECK (status IN
                        ('processing', 'in_transit', 'customs', 'out_for_delivery', 'delivered')),
  origin              VARCHAR(200),
  destination         VARCHAR(200),
  vessel              VARCHAR(200),
  weight              VARCHAR(50),
  dimensions          VARCHAR(100),
  recipient           VARCHAR(200),
  estimated_delivery  DATE,
  is_public           BOOLEAN DEFAULT FALSE,    -- Skip RBAC check if true
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_public ON shipments(is_public);
```

### `shipment_logs`
```sql
CREATE TABLE shipment_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  VARCHAR(14) REFERENCES shipments(id) ON DELETE CASCADE,
  event        VARCHAR(100) NOT NULL,
  location     VARCHAR(200),
  note         TEXT,
  logged_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_shipment_id ON shipment_logs(shipment_id);
```

### `shipment_access` (RBAC table)
```sql
CREATE TABLE shipment_access (
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  shipment_id  VARCHAR(14) REFERENCES shipments(id) ON DELETE CASCADE,
  granted_by   UUID REFERENCES users(id),
  granted_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, shipment_id)
);

CREATE INDEX idx_access_user_id      ON shipment_access(user_id);
CREATE INDEX idx_access_shipment_id  ON shipment_access(shipment_id);
```

### `push_subscriptions`
```sql
CREATE TABLE push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## REST API Endpoints

### Authentication

| Method | Endpoint              | Description                           | Auth Required |
|--------|-----------------------|---------------------------------------|---------------|
| POST   | `/api/auth/login`     | Login with email + password           | No            |
| POST   | `/api/auth/refresh`   | Refresh access token                  | No (uses cookie) |
| POST   | `/api/auth/logout`    | Invalidate refresh token              | Yes           |
| POST   | `/api/auth/forgot`    | Send password reset email             | No            |
| POST   | `/api/auth/reset`     | Reset password with token             | No            |

**Login Request Body:**
```json
{ "email": "user@tas.com", "password": "secret123" }
```
**Login Response:**
```json
{
  "user": { "id": "uuid", "name": "Alex", "email": "...", "role": "user" },
  "accessToken": "eyJhbGc..."
}
```

---

### Shipments

| Method | Endpoint                        | Description                          | Auth Required | Role    |
|--------|---------------------------------|--------------------------------------|---------------|---------|
| GET    | `/api/shipments`                | List all shipments (admin sees all)  | Yes           | Admin   |
| POST   | `/api/shipments`                | Create a new shipment                | Yes           | Admin   |
| GET    | `/api/shipments/:id`            | Get shipment by tracking ID (RBAC)   | Yes           | Any     |
| PATCH  | `/api/shipments/:id`            | Update shipment details/status       | Yes           | Admin   |
| DELETE | `/api/shipments/:id`            | Delete shipment                      | Yes           | Admin   |
| POST   | `/api/shipments/:id/logs`       | Add event log entry                  | Yes           | Admin   |
| GET    | `/api/shipments/:id/logs`       | Get all logs for a shipment          | Yes           | RBAC    |

**RBAC middleware for GET `/api/shipments/:id`:**
```js
// Pseudocode
async function shipmentAccessGuard(req, res, next) {
  const { id } = req.params;
  const userId = req.user.id;
  const role   = req.user.role;

  if (role === 'admin') return next(); // Admins bypass RBAC

  const shipment = await db.shipments.findById(id);
  if (!shipment) return res.status(404).json({ error: 'Not found' });

  if (shipment.is_public) return next(); // Public shipment — no check needed

  const access = await db.shipmentAccess.find({ user_id: userId, shipment_id: id });
  if (!access) return res.status(403).json({ error: 'Access denied' });

  next();
}
```

---

### Access Control (RBAC)

| Method | Endpoint                                      | Description               | Role  |
|--------|-----------------------------------------------|---------------------------|-------|
| GET    | `/api/access/users/:userId`                   | List all shipment access for user | Admin |
| POST   | `/api/access/grant`                           | Grant user access to shipment    | Admin |
| DELETE | `/api/access/revoke`                          | Revoke user access               | Admin |
| PATCH  | `/api/shipments/:id/public`                   | Toggle public flag               | Admin |

**Grant Access Body:**
```json
{ "userId": "uuid", "shipmentId": "TAS-A1B2C3D4" }
```

---

## Real-time Updates

### Option A: Server-Sent Events (SSE) — Recommended for tracking
SSE provides a one-way persistent connection from server to browser. Simple, firewall-friendly.

```
GET /api/shipments/:id/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

Server emits:
```
event: status_update
data: {"status":"out_for_delivery","location":"Toronto Hub","timestamp":"2026-05-21T09:00:00Z"}

event: log_added
data: {"event":"Out for Delivery","note":"Driver en route"}
```

### Option B: WebSockets (Socket.IO)
Use when bidirectional communication is needed (e.g., admin push updates instantly to all tracking users).

```js
// Server
io.on('connection', (socket) => {
  socket.on('subscribe_shipment', (trackingId) => {
    // Verify RBAC, then join room
    socket.join(`shipment:${trackingId}`);
  });
});

// When status changes
io.to(`shipment:${id}`).emit('status_update', { status, location, timestamp });
```

---

## Push Notifications (Web Push API)

### Flow
1. User registers a Service Worker on their browser.
2. Browser generates a Push Subscription object (endpoint + keys).
3. Frontend POSTs the subscription to `/api/push/subscribe`.
4. When a shipment status changes, the backend sends a Web Push notification.

### Service Worker Registration
```js
// sw.js (service worker)
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/badge.png',
    data: { url: data.url },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  clients.openWindow(event.notification.data.url);
});
```

### Backend Push Trigger
```js
const webpush = require('web-push');

webpush.setVapidDetails('mailto:admin@tas.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function notifyUser(userId, shipmentId, status) {
  const subscriptions = await db.pushSubscriptions.findByUserId(userId);
  const payload = JSON.stringify({
    title: `TAS: Shipment ${shipmentId} Update`,
    body:  `Your shipment is now: ${STATUS_LABELS[status]}`,
    url:   `/track/${shipmentId}`,
  });

  for (const sub of subscriptions) {
    await webpush.sendNotification(sub, payload).catch(console.error);
  }
}
```

---

## Security Checklist

- [ ] **Password hashing**: bcrypt with cost factor ≥ 12
- [ ] **JWT expiry**: Access token 15 minutes, refresh token 7 days (rotated)
- [ ] **HTTPS only**: Enforce TLS in production; `Secure` + `HttpOnly` cookies
- [ ] **Input validation**: Validate all request bodies with Zod or Joi
- [ ] **Rate limiting**: 20 req/min per IP on auth endpoints (express-rate-limit)
- [ ] **SQL injection**: Use parameterized queries (pg library or Drizzle ORM)
- [ ] **CORS**: Whitelist only the frontend origin
- [ ] **Audit logging**: Log all RBAC grant/revoke actions with admin user ID + timestamp
- [ ] **Helmet.js**: Set security headers (CSP, HSTS, X-Frame-Options, etc.)
- [ ] **Environment variables**: Store all secrets in `.env` (never commit)

---

## Firebase Firestore Alternative

If using Firebase instead of PostgreSQL:

```
Collections:
  users/{userId}           — user profile + role
  shipments/{trackingId}   — shipment data + isPublic flag
  shipments/{id}/logs/     — subcollection of log entries
  access/{userId_shipId}   — document granting access (userId + shipmentId)
  pushSubscriptions/{id}   — push subscription per user
```

**Firestore Security Rules (simplified):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Admins can read/write everything
    match /{document=**} {
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users can read public shipments
    match /shipments/{shipmentId} {
      allow read: if resource.data.isPublic == true && request.auth != null;
    }

    // Users can read shipments they have access to
    match /shipments/{shipmentId} {
      allow read: if exists(/databases/$(database)/documents/access/$(request.auth.uid + '_' + shipmentId));
    }
  }
}
```

---

*Document maintained by TAS Engineering. Last updated: May 2026.*
