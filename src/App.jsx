/**
 * App.jsx — TAS Tracking Application Root
 * =========================================
 * Routing logic:
 *
 *   Public (no session)
 *   ├── view === 'public'  → PublicTrack  (default landing)
 *   └── view === 'login'   → Login page
 *
 *   Authenticated
 *   ├── role === 'admin'   → AdminDashboard
 *   └── role === 'user'    → UserDashboard
 *
 * State is persisted in localStorage so a page refresh keeps the session alive.
 */

import { useState, useEffect } from 'react';
import db from './utils/mockDb';
import PublicTrack   from './pages/PublicTrack';
import Login         from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  // ── Initialize DB on first load ───────────────────────────────────────────
  useEffect(() => {
    db.initDb(); // Seeds localStorage with users + shipments if empty
  }, []);

  // ── Session State ─────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => db.getCurrentUser());

  // 'public' | 'login' — only relevant when no user is logged in
  const [view, setView] = useState('public');

  // ── Auth Handlers ─────────────────────────────────────────────────────────
  const handleLogin = (user) => {
    setCurrentUser(user);
    setView('public'); // Reset view for next logout
  };

  const handleLogout = () => {
    db.logout();
    setCurrentUser(null);
    setView('public'); // Return to public landing after sign-out
  };

  // ── Routing ───────────────────────────────────────────────────────────────

  // Authenticated: route by role
  if (currentUser) {
    if (currentUser.role === 'admin') {
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    }
    return <UserDashboard user={currentUser} onLogout={handleLogout} />;
  }

  // Unauthenticated: show public tracker or login
  if (view === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onBack={() => setView('public')} // Allow returning to public page
      />
    );
  }

  return (
    <PublicTrack
      onGoToLogin={() => setView('login')}
    />
  );
}
