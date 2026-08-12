/**
 * BehaviorEvent Model
 * Raw events emitted by the frontend tracker (views, clicks, searches, etc.)
 */
const mongoose = require('mongoose');

const BehaviorEventSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  sessionId:  { type: String, index: true },        // Anonymous session tracking
  eventType:  {
    type: String,
    enum: ['view', 'click', 'search', 'add_to_cart', 'remove_from_cart', 'purchase', 'dwell', 'page_visit'],
    required: true,
    index: true
  },
  productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  category:   { type: String, default: null },
  query:      { type: String, default: null },     // For search events
  dwellMs:    { type: Number, default: null },     // Time spent on page (ms)
  metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:         { type: String, default: null },
  userAgent:  { type: String, default: null },
}, {
  timestamps: true,
  // Auto-expire raw events after 90 days to save storage
  expireAfterSeconds: 60 * 60 * 24 * 90
});

const BehaviorEvent = mongoose.model('BehaviorEvent', BehaviorEventSchema);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * UserProfile Model
 * Aggregated behavior profile for each user — updated by the Behavior Intelligence Engine.
 * This is the "learned" model of the user.
 */
const CategoryAffinitySchema = new mongoose.Schema({
  category: String,
  score: { type: Number, default: 0 }, // Weighted affinity score
  viewCount: { type: Number, default: 0 },
  purchaseCount: { type: Number, default: 0 },
}, { _id: false });

const ProductInteractionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  viewCount:    { type: Number, default: 0 },
  dwellMs:      { type: Number, default: 0 },   // Total dwell time
  addedToCart:  { type: Boolean, default: false },
  purchased:    { type: Boolean, default: false },
  lastSeenAt:   { type: Date, default: Date.now },
}, { _id: false });

const UserProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },

  // Category preferences ranked by affinity score
  categoryAffinities: [CategoryAffinitySchema],

  // Per-product interaction history (last 100 products)
  productInteractions: [ProductInteractionSchema],

  // Recent search queries
  recentSearches: [{ type: String }],

  // Computed recommendation cache (refreshed by engine)
  recommendedProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // Behavioral stats
  totalPageViews:   { type: Number, default: 0 },
  totalSearches:    { type: Number, default: 0 },
  totalPurchases:   { type: Number, default: 0 },
  avgSessionMs:     { type: Number, default: 0 },
  lastActivityAt:   { type: Date, default: Date.now },

  // Profile freshness — used to determine if re-computation is needed
  profileUpdatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const UserProfile = mongoose.model('UserProfile', UserProfileSchema);

module.exports = { BehaviorEvent, UserProfile };
