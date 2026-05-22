# TAS — Track & Ship 🚢✈️

> A modern, professional cargo and parcel tracking web application with role-based access control, real-time status updates, and an admin control panel.

**Live demo:** http://localhost:5173 (run locally — see below)

---

## ✨ Features

### 🌐 Public Tracking (no login required)
- Anyone can track a parcel by entering a Tracking ID
- reCAPTCHA v2 verification on every search to prevent bot abuse
- Public shipments show full details (stepper, timeline, cargo info)
- Restricted shipments prompt visitors to sign in

### 🔐 Role-Based Authentication
| Role | Access |
|------|--------|
| **Admin** | Full control — create/edit/delete shipments, manage RBAC |
| **User** | View public shipments + any shipments explicitly granted |

### 👤 User Dashboard
- Tracking ID search with live validation
- Visual 5-step shipment journey stepper with animated progress
- Route details, cargo specs, vessel/flight info
- Reverse-chronological activity log with timestamps

### 🛡️ Admin Dashboard
- **Overview** — live stats (Active, Delivered, Processing, Total)
- **Shipment Management** — create, update status, add log events, delete
- **Access Control (RBAC)** — interactive user × shipment matrix; click to grant/revoke
- **User Management** — view all accounts, roles, and shipment access counts
- Toast notifications for all actions

### 🎨 Design
- Deep Space Navy dark theme with glassmorphism cards
- Inter font, smooth animations, micro-interactions
- Fully responsive (mobile, tablet, desktop)
- Animated stepper, live-pulse status dots, floating orb background

---

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/roigrafix/tas-tracking.git
cd tas-tracking

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:5173**

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

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Get your key at https://www.google.com/recaptcha/admin/create
# Choose: reCAPTCHA v2 → "I'm not a robot" checkbox
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

> Without this, the app falls back to Google's **test key** (`6LeIxAcT...`) which always passes — only use for local development.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (custom design system) |
| Auth / State | LocalStorage-backed mock DB |
| reCAPTCHA | `react-google-recaptcha` v2 |
| Icons | Emoji + inline SVG |

---

## 📁 Project Structure

```
src/
├── App.jsx                  # Root router (Public → Login → Dashboard)
├── index.css                # Full design system (tokens, components, animations)
├── main.jsx                 # Entry point
├── components/
│   └── ReCaptcha.jsx        # Real Google reCAPTCHA v2 wrapper
├── pages/
│   ├── PublicTrack.jsx      # Public landing + tracking page
│   ├── Login.jsx            # Authentication page
│   ├── UserDashboard.jsx    # Standard user tracking view
│   └── AdminDashboard.jsx   # Full admin control panel
└── utils/
    └── mockDb.js            # LocalStorage DB mock (users, shipments, RBAC)

database_architecture.md     # Full backend API & DB design spec (PostgreSQL, REST, SSE, Web Push)
```

---

## 🗄️ Backend Architecture

See [`database_architecture.md`](./database_architecture.md) for a full production-ready backend design:

- **PostgreSQL schema** — `users`, `shipments`, `shipment_logs`, `shipment_access`, `push_subscriptions`
- **REST API** — all endpoints with RBAC middleware pseudocode
- **Real-time updates** — Server-Sent Events (SSE) and Socket.IO patterns
- **Web Push notifications** — Service Worker + FCM integration
- **Firebase Firestore** — alternative schema + security rules
- **Security checklist** — bcrypt, JWT, HTTPS, rate limiting, Helmet.js

---

## 📜 License

MIT — free to use, modify, and distribute.

---

*Built with ❤️ for TAS Track & Ship*
