/**
 * Product Model
 * Full product catalog with category, pricing, stock, and analytics counters.
 */
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true, min: 0 },
  category:    { type: String, required: true, index: true },
  brand:       { type: String, default: '' },
  imageUrl:    { type: String, default: '/images/placeholder.png' },
  images:      [{ type: String }],
  stock:       { type: Number, default: 0, min: 0 },
  rating:      { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  tags:        [{ type: String }],
  isActive:    { type: Boolean, default: true },

  // Behavior analytics counters (updated by behavior engine)
  viewCount:     { type: Number, default: 0 },
  cartAddCount:  { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },
  trendScore:    { type: Number, default: 0 }, // Computed trending score
}, { timestamps: true });

// Full-text search index
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
