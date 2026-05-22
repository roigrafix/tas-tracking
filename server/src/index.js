/**
 * index.js — TAS Tracking Server
 * =================================
 * Express application entry point.
 * Initializes the database, seeds on first run, and mounts all routes.
 */

require('dotenv').config();
require('express-async-errors'); // Catch async errors automatically

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const cookieParser= require('cookie-parser');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const { initDb, queryOne } = require('./db/database');
const { seed }             = require('./db/seed');

// Routes
const authRoutes     = require('./routes/auth');
const shipmentsRoutes= require('./routes/shipments');
const accessRoutes   = require('./routes/access');
const usersRoutes    = require('./routes/users');
const publicRoutes   = require('./routes/public');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow reCAPTCHA iframe
  contentSecurityPolicy: false,     // Configure separately in production
}));

app.use(cors({
  origin:      process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true, // Allow cookies
  methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(cookieParser());
app.use(express.json());

// ── Rate Limiting ─────────────────────────────────────────────────────────────

// Strict limit on auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { error: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      120,
  message:  { error: 'Too many requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
  skip: (req) => req.path.endsWith('/events'), // Skip SSE streams
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ── Health Check (before auth-gated routes) ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'TAS Tracking API',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/public',    publicRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/access',    accessRoutes);
app.use('/api/users',     usersRoutes);

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message,
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await initDb();
    console.log('[DB] Database initialized');

    // Auto-seed if users table is empty
    const userCount = queryOne('SELECT COUNT(*) AS n FROM users').n;
    if (userCount === 0) {
      console.log('[SEED] No users found — running seed...');
      await seed();
    }

    app.listen(PORT, () => {
      console.log(`\n🚢 TAS Tracking API`);
      console.log(`   Running on: http://localhost:${PORT}`);
      console.log(`   Health:     http://localhost:${PORT}/api/health`);
      console.log(`   Mode:       ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
}

start();
