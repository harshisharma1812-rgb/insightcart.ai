/**
 * Auth Middleware — Verifies JWT tokens and attaches user to request
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Require a valid JWT token. Returns 401 if missing or invalid.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'User not found or deactivated' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

/**
 * Optionally attach user if token is present (doesn't fail for anonymous).
 * Used for routes that serve both guests and authenticated users.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (_) { /* ignore auth errors for optional routes */ }
  next();
};

/**
 * Require admin role. Must be used after `protect`.
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: 'Admin access required' });
};

module.exports = { protect, optionalAuth, adminOnly };
