/**
 * Admin Routes — /api/admin
 * All routes require authentication + admin role.
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const { Order } = require('../models/Order');
const { getPlatformAnalytics, recomputeTrendingScores } = require('../utils/behaviorEngine');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// GET /api/admin/stats — Overview stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalProducts, allOrders] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      Product.countDocuments({ isActive: true }),
      Order.find().select('total paymentStatus status createdAt'),
    ]);

    const paidOrders = allOrders.filter(o => o.paymentStatus === 'paid');
    const revenue = paidOrders.reduce((s, o) => s + o.total, 0);
    const statusCounts = allOrders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProducts,
        totalOrders: allOrders.length,
        totalRevenue: parseFloat(revenue.toFixed(2)),
        avgOrderValue: paidOrders.length
          ? parseFloat((revenue / paidOrders.length).toFixed(2))
          : 0,
        ordersByStatus: statusCounts,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/analytics — Full behavioral analytics
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await getPlatformAnalytics();
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/recompute-trends
router.post('/recompute-trends', async (req, res) => {
  try {
    await recomputeTrendingScores(7);
    res.json({ success: true, message: 'Trending scores recomputed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const filter = role ? { role } : {};
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  try {
    const { isActive, role } = req.body;
    const update = {};
    if (isActive !== undefined) update.isActive = isActive;
    if (role) update.role = role;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/orders
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('userId', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, orders, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/products — Admin product list with full stats
router.get('/products', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [products, total] = await Promise.all([
      Product.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      Product.countDocuments(),
    ]);
    res.json({ success: true, products, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
