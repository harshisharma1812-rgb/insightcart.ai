/**
 * InsightCart AI — Express Server Entry Point
 * Registers all routes, middleware, and starts the HTTP server.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/db');

// ── Route Modules ──────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const productRoutes       = require('./routes/products');
const cartRoutes          = require('./routes/cart');
const orderRoutes         = require('./routes/orders');
const paymentRoutes       = require('./routes/payments');
const behaviorRoutes      = require('./routes/behavior');
const recommendationRoutes = require('./routes/recommendations');
const adminRoutes         = require('./routes/admin');

const app = express();

// ── Connect to MongoDB ─────────────────────────────────────────────────────────
connectDB();

// ── Global Middleware ──────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve frontend static files
app.use(express.static('frontend'));

// Rate limiting — protect all API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',            authRoutes);
app.use('/api/products',        productRoutes);
app.use('/api/cart',            cartRoutes);
app.use('/api/orders',          orderRoutes);
app.use('/api/payments',        paymentRoutes);
app.use('/api/behavior',        behaviorRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin',           adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'InsightCart AI is running 🛒🧠', time: new Date() });
});

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// ── Start Server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 InsightCart AI server running on http://localhost:${PORT}`);
  console.log(`📊 Admin dashboard: http://localhost:${PORT}/admin/dashboard.html`);
  console.log(`🛒 Shop: http://localhost:${PORT}/index.html\n`);
});

module.exports = app;
