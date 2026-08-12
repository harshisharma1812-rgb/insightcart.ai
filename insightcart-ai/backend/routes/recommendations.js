/**
 * Recommendation Routes — /api/recommendations
 */
const express = require('express');
const router = express.Router();
const { generateRecommendations } = require('../utils/behaviorEngine');
const Product = require('../models/Product');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    if (req.user) {
      const recs = await generateRecommendations(req.user._id, limit);
      return res.json({ success: true, recommendations: recs, personalized: true });
    } else {
      const products = await Product.find({ isActive: true, stock: { $gt: 0 } })
        .sort({ trendScore: -1 }).limit(limit);
      return res.json({
        success: true,
        recommendations: products.map(p => ({ ...p.toObject(), recommendReason: 'Trending now' })),
        personalized: false
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
