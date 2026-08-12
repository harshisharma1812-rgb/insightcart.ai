/**
 * Cart Routes — /api/cart
 */
const express = require('express');
const { CartItem } = require('../models/Order');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const cartRouter = express.Router();

// GET /api/cart — Get current user's cart with product details
cartRouter.get('/', protect, async (req, res) => {
  try {
    const items = await CartItem.find({ userId: req.user._id }).populate('productId');
    const cartTotal = items.reduce((sum, item) => {
      return sum + (item.productId?.price || 0) * item.quantity;
    }, 0);
    res.json({ success: true, items, cartTotal });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/cart — Add item to cart (or update quantity)
cartRouter.post('/', protect, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isActive)
      return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.stock < quantity)
      return res.status(400).json({ success: false, error: 'Insufficient stock' });

    const item = await CartItem.findOneAndUpdate(
      { userId: req.user._id, productId },
      { $inc: { quantity } },
      { upsert: true, new: true }
    );
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/cart/:itemId — Update quantity
cartRouter.put('/:itemId', protect, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 1)
      return res.status(400).json({ success: false, error: 'Quantity must be at least 1' });

    const item = await CartItem.findOneAndUpdate(
      { _id: req.params.itemId, userId: req.user._id },
      { quantity },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, error: 'Cart item not found' });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/cart/:itemId — Remove item
cartRouter.delete('/:itemId', protect, async (req, res) => {
  try {
    await CartItem.findOneAndDelete({ _id: req.params.itemId, userId: req.user._id });
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/cart — Clear entire cart
cartRouter.delete('/', protect, async (req, res) => {
  try {
    await CartItem.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = cartRouter;
