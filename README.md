# TAS — Track & Ship 🚢✈️

> A complete full-stack cargo and parcel tracking web application with a real Express.js backend, SQLite database, JWT authentication, server-side reCAPTCHA verification, role-based access control, and Server-Sent Events for real-time updates.

**Repo:** https://github.com/roigrafix/tas-tracking

---

## ✨ Features

### 🌐 Public Tracking (no login required)
- Anyone can look up a parcel by Tracking ID
- Server-side **reCAPTCHA v2** verification on every request
- Public shipments → full stepper, timeline, cargo details
- Restricted shipments → "Sign in to check your access"

### 🔐 Full JWT Authentication
- **Access tokens** (15 min) via `Authorization: Bearer` header
- **Refresh tokens** (7 days) as `httpOnly` cookies — auto-rotate on use
- SHA-256 hashed token storage (raw tokens never persisted)
- Password hashing with **bcrypt** (cost 12)
- Enumeration-safe login and forgot-password endpoints

### 👤 Role-Based Access Control
| Role | Access |
|------|--------|
| **Admin** | Create/edit/delete shipments, manage RBAC grants, view stats |
| **User** | View public + explicitly granted shipments |

### 📡 Real-time SSE Updates
- `GET /api/shipments/:id/events` — Server-Sent Events stream
- Admin status changes and log entries broadcast instantly to all subscribers
- Frontend auto-subscribes via `EventSource`

### 🛡️ Security
- **Helmet.js** security headers
- **CORS** with origin whitelist + credentials
- **Rate limiting**: 20 req/15min on auth, 120 req/min on API
- reCAPTCHA on every public-facing form (server-side verified)
- `.env` secrets never committed; `.gitignore` enforced

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### 1. Clone & install

```bash
git clone https://github.com/roigrafix/tas-tracking.git
cd tas-tracking

# Frontend dependencies
npm install

# Backend dependencies
cd server && npm install && cd ..
```

### 2. Configure environment

```bash
# Frontend (.env in project root)
VITE_RECAPTCHA_SITE_KEY=your_site_key_here

# Backend (server/.env — copy from server/.env.example)
cp server/.env.example server/.env
# Edit server/.env:
#   JWT_ACCESS_SECRET=<64-char random hex>
#   JWT_REFRESH_SECRET=<64-char random hex>
#   RECAPTCHA_SECRET_KEY=your_secret_key
#   RECAPTCHA_SKIP_VERIFY=true   ← for local dev only, remove in production
```

> Generate JWT secrets: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### 3. Start both servers

**Terminal 1 — Backend (port 3001):**
```bash
cd server && node src/index.js
```

**Terminal 2 — Frontend (port 5173):**
```bash
npm run dev
```

Open **http://localhost:5173** — the DB auto-seeds on first start.

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| 🛡️ Admin | `admin@tas.com` | `admin123` |
| 👤 User | `user@tas.com` | `user123` |
| 👤 Guest | `guest@tas.com` | `guest123` |

### Sample Tracking IDs

| ID | Status | Access |
|----|--------|--------|
| `TAS-A1B2C3D4` | In Transit | 🌐 Public |
| `TAS-M3N4O5P6` | Delivered | 🌐 Public |
| `TAS-E5F6G7H8` | Customs | 🔒 `user@tas.com` only |
| `TAS-I9J0K1L2` | Out for Delivery | 🔒 `guest@tas.com` only |

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/health` | None | Health check |
| `POST` | `/api/auth/login` | None + captcha | Login → access token + refresh cookie |
| `POST` | `/api/auth/refresh` | Cookie | Rotate refresh token |
| `POST` | `/api/auth/logout` | Bearer | Revoke refresh token |
| `POST` | `/api/auth/forgot` | None | Password reset (enumeration-safe) |
| `POST` | `/api/public/track` | None + captcha | Public shipment lookup |
| `GET`  | `/api/shipments` | Admin | List all shipments |
| `POST` | `/api/shipments` | Admin | Create shipment |
| `GET`  | `/api/shipments/:id` | RBAC | Get shipment + logs |
| `PATCH`| `/api/shipments/:id` | Admin | Update details/status |
| `DELETE`| `/api/shipments/:id` | Admin | Delete shipment |
| `POST` | `/api/shipments/:id/logs` | Admin | Add log entry |
| `GET`  | `/api/shipments/:id/events` | RBAC | SSE real-time stream |
| `PATCH`| `/api/shipments/:id/public` | Admin | Toggle public flag |
| `GET`  | `/api/shipments/stats` | Admin | Dashboard stats |
| `GET`  | `/api/access` | Admin | All RBAC grants |
| `POST` | `/api/access/grant` | Admin | Grant user access |
| `POST` | `/api/access/revoke` | Admin | Revoke user access |
| `GET`  | `/api/users` | Admin | List all users |

---

## 📁 Project Structure

```
tas-tracking/
├── index.html
├── vite.config.js           ← Proxies /api → localhost:3001
├── .env                     ← VITE_RECAPTCHA_SITE_KEY (gitignored)
│
├── src/                     ← React + Vite frontend
│   ├── App.jsx              ← Routing + session restore on mount
│   ├── index.css            ← Full dark design system
│   ├── components/
│   │   └── ReCaptcha.jsx    ← Real react-google-recaptcha v2
│   ├── pages/
│   │   ├── PublicTrack.jsx  ← Public landing + tracking
│   │   ├── Login.jsx        ← JWT auth + reCAPTCHA
│   │   ├── UserDashboard.jsx
│   │   └── AdminDashboard.jsx
│   └── utils/
│       ├── api.js           ← Centralized fetch client (auto-refresh JWT)
│       └── mockDb.js        ← Legacy (no longer used)
│
└── server/                  ← Express.js backend
    ├── .env                 ← Secrets (gitignored)
    ├── .env.example         ← Template
    ├── package.json
    └── src/
        ├── index.js         ← App entry, middleware, routes
        ├── db/
        │   ├── database.js  ← sql.js SQLite + schema + persistence
        │   └── seed.js      ← Demo users, shipments, logs, access
        ├── middleware/
        │   ├── auth.js      ← JWT Bearer + optionalAuth + requireAdmin
        │   └── recaptcha.js ← Server-side Google reCAPTCHA verify
        ├── routes/
        │   ├── auth.js      ← Login, refresh, logout, forgot
        │   ├── shipments.js ← CRUD + SSE + logs + stats
        │   ├── access.js    ← RBAC grant/revoke
        │   ├── users.js     ← User listing
        │   └── public.js    ← Public track (no auth)
        └── utils/
            └── jwt.js       ← Token gen, verify, revoke, cookies
```

---

## 🗄️ Database Schema (SQLite)

| Table | Key Fields |
|-------|-----------|
| `users` | id, name, email, password_hash, role, is_active |
| `shipments` | id, description, status, origin, destination, vessel, is_public |
| `shipment_logs` | id, shipment_id, event, location, note, logged_at |
| `shipment_access` | user_id, shipment_id, granted_by (composite PK) |
| `refresh_tokens` | token_hash, user_id, expires_at |

The SQLite file is saved to `server/data/tas.db` (gitignored).

---

## 🚢 Production Deployment

1. **Swap SQLite → PostgreSQL** — replace `sql.js` with `pg` + connection pool
2. **Set `NODE_ENV=production`** — removes dev bypass warning
3. **Remove `RECAPTCHA_SKIP_VERIFY`** — real verification enforced
4. **Set strong JWT secrets** — 64+ character random hex strings
5. **Deploy backend** on Railway / Render / Fly.io / EC2
6. **Deploy frontend** on Vercel / Netlify / Firebase Hosting
7. **Update `FRONTEND_ORIGIN`** in server `.env` to your real domain
8. **Configure `VITE_RECAPTCHA_SITE_KEY`** in your deployment platform

---

*Built with ❤️ for TAS Track & Ship*
