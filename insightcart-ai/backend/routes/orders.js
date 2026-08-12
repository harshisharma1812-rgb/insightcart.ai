/**
 * Order Routes — /api/orders
 */
const express = require('express');
const { Order, CartItem } = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders — Place an order from current cart
router.post('/', protect, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod = 'card', notes } = req.body;

    // Load cart
    const cartItems = await CartItem.find({ userId: req.user._id }).populate('productId');
    if (!cartItems.length)
      return res.status(400).json({ success: false, error: 'Cart is empty' });

    // Build order items snapshot
    const items = cartItems.map(ci => ({
      productId: ci.productId._id,
      name:      ci.productId.name,
      price:     ci.productId.price,
      quantity:  ci.quantity,
      imageUrl:  ci.productId.imageUrl,
    }));

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const tax = parseFloat((subtotal * 0.08).toFixed(2)); // 8% tax
    const total = parseFloat((subtotal + tax).toFixed(2));

    const order = await Order.create({
      userId: req.user._id,
      items,
      subtotal,
      tax,
      total,
      paymentMethod,
      shippingAddress,
      notes,
      status: 'pending',
      paymentStatus: 'pending',
    });

    // Decrement stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
    }

    // Clear cart
    await CartItem.deleteMany({ userId: req.user._id });

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders — Get current user's orders
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const filter = req.user.role === 'admin' ? {} : { userId: req.user._id };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('userId', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, orders, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:id — Single order
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('userId', 'name email');
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Customers can only view their own orders
    if (req.user.role !== 'admin' && order.userId._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Access denied' });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/orders/:id/status — Admin: update order status
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
