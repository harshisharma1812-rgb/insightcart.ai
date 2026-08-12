/**
 * Product Routes — /api/products
 * Public: list, search, get single product
 * Protected (admin): create, update, delete
 */
const express = require('express');
const Product = require('../models/Product');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products — List products with filtering, search, pagination
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      q, category, minPrice, maxPrice,
      sort = 'trendScore', order = 'desc',
      page = 1, limit = 20
    } = req.query;

    const filter = { isActive: true };

    // Full-text search
    if (q) filter.$text = { $search: q };
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const sortObj = {};
    sortObj[sort] = order === 'asc' ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(Number(limit)),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      products,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/categories — List all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/trending — Top trending products
router.get('/trending', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true, stock: { $gt: 0 } })
      .sort({ trendScore: -1 })
      .limit(12);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id — Single product detail
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products — Admin: create product
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id — Admin: update product
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/:id — Admin: soft delete
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
