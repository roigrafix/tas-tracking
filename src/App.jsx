/**
 * App.jsx — TAS Tracking Application Root
 * =========================================
 * Now uses the real backend API for all auth operations.
 * Access token lives in module memory (api.js); session is restored
 * via refresh token (httpOnly cookie) on page load.
 */

import { useState, useEffect, useCallback } from 'react';
import { auth, onSessionExpired, clearAccessToken } from './utils/api';
import PublicTrack    from './pages/PublicTrack';
import Login          from './pages/Login';
import UserDashboard  from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView]               = useState('public'); // 'public' | 'login'
  const [restoring, setRestoring]     = useState(true);     // true while attempting token refresh on load

  // ── Restore session from refresh cookie on mount ───────────────────────────
  useEffect(() => {
    auth.refresh()
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  // ── Register session-expired callback ──────────────────────────────────────
  const handleSessionExpired = useCallback(() => {
    setCurrentUser(null);
    clearAccessToken();
    setView('login');
  }, []);

  useEffect(() => {
    onSessionExpired(handleSessionExpired);
  }, [handleSessionExpired]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleLogin = (user) => {
    setCurrentUser(user);
    setView('public');
  };

  const handleLogout = async () => {
    await auth.logout();
    setCurrentUser(null);
    setView('public');
  };

  // ── Loading screen while restoring session ─────────────────────────────────
  if (restoring) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#050c1a', flexDirection: 'column', gap: '1rem'
      }}>
        <div style={{
          width: 48, height: 48,
          background: 'linear-gradient(135deg,#2563eb,#06b6d4)',
          borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: '1rem'
        }}>TAS</div>
        <div style={{
          width: 36, height: 36, border: '3px solid rgba(37,99,235,0.2)',
          borderTopColor: '#2563eb', borderRadius: '50%',
          animation: 'spin 700ms linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Routing ────────────────────────────────────────────────────────────────
  if (currentUser) {
    if (currentUser.role === 'admin') {
      return <AdminDashboard user={currentUser} onLogout={handleLogout} />;
    }
    return <UserDashboard user={currentUser} onLogout={handleLogout} />;
  }

  if (view === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onBack={() => setView('public')}
      />
    );
  }

  return <PublicTrack onGoToLogin={() => setView('login')} />;
}
