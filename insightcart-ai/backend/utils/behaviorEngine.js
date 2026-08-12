/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         BEHAVIOR INTELLIGENCE ENGINE                         ║
 * ║  InsightCart AI — Core module for user behavior analysis     ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * This engine:
 *  1. Ingests raw behavior events
 *  2. Updates the user's aggregated behavior profile
 *  3. Computes category affinities using weighted scoring
 *  4. Generates personalized recommendation lists
 *  5. Computes platform-wide trending scores for products
 */

const { BehaviorEvent, UserProfile } = require('../models/BehaviorEvent');
const Product = require('../models/Product');

// ── Event Weights ──────────────────────────────────────────────────────────────
// Higher weight = stronger signal of user interest
const EVENT_WEIGHTS = {
  view:             1.0,
  click:            1.5,
  search:           1.2,
  add_to_cart:      3.0,
  remove_from_cart:-1.0,
  purchase:         5.0,
  dwell:            0.5,  // per second of dwell time
  page_visit:       0.3,
};

// Category affinity decay factor (older events matter less)
const DECAY_RATE = 0.95; // per day

/**
 * Process a behavior event: update UserProfile and product counters.
 * Called whenever a new BehaviorEvent is created.
 *
 * @param {Object} event - Mongoose BehaviorEvent document
 */
async function processEvent(event) {
  if (!event.userId) return; // Skip anonymous events for profile building

  // Atomically find or create the user profile
  let profile = await UserProfile.findOne({ userId: event.userId });
  if (!profile) {
    profile = new UserProfile({ userId: event.userId });
  }

  const weight = EVENT_WEIGHTS[event.eventType] || 0;

  // ── Update category affinity ───────────────────────────────────────────────
  if (event.category) {
    let affinity = profile.categoryAffinities.find(a => a.category === event.category);
    if (!affinity) {
      profile.categoryAffinities.push({ category: event.category, score: 0 });
      affinity = profile.categoryAffinities[profile.categoryAffinities.length - 1];
    }
    affinity.score += weight;
    if (event.eventType === 'view' || event.eventType === 'page_visit') affinity.viewCount += 1;
    if (event.eventType === 'purchase') affinity.purchaseCount += 1;
  }

  // ── Update product interactions ────────────────────────────────────────────
  if (event.productId) {
    let interaction = profile.productInteractions.find(
      p => p.productId && p.productId.toString() === event.productId.toString()
    );
    if (!interaction) {
      profile.productInteractions.push({ productId: event.productId });
      interaction = profile.productInteractions[profile.productInteractions.length - 1];
    }

    if (event.eventType === 'view')         interaction.viewCount += 1;
    if (event.eventType === 'dwell')        interaction.dwellMs += (event.dwellMs || 0);
    if (event.eventType === 'add_to_cart')  interaction.addedToCart = true;
    if (event.eventType === 'purchase')     interaction.purchased = true;
    interaction.lastSeenAt = new Date();

    // Trim to last 200 product interactions to avoid unbounded growth
    if (profile.productInteractions.length > 200) {
      profile.productInteractions = profile.productInteractions
        .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
        .slice(0, 200);
    }
  }

  // ── Update search history ──────────────────────────────────────────────────
  if (event.eventType === 'search' && event.query) {
    profile.recentSearches.unshift(event.query.toLowerCase());
    // Keep last 20 searches
    profile.recentSearches = [...new Set(profile.recentSearches)].slice(0, 20);
    profile.totalSearches += 1;
  }

  // ── Update aggregate stats ─────────────────────────────────────────────────
  if (['view', 'page_visit'].includes(event.eventType)) profile.totalPageViews += 1;
  if (event.eventType === 'purchase') profile.totalPurchases += 1;
  profile.lastActivityAt = new Date();
  profile.profileUpdatedAt = new Date();

  // ── Update product-level counters ──────────────────────────────────────────
  if (event.productId) {
    const update = {};
    if (event.eventType === 'view')        update.viewCount = 1;
    if (event.eventType === 'add_to_cart') update.cartAddCount = 1;
    if (event.eventType === 'purchase')    update.purchaseCount = 1;

    if (Object.keys(update).length) {
      await Product.findByIdAndUpdate(event.productId, { $inc: update });
    }
  }

  await profile.save();
}

/**
 * Generate personalized product recommendations for a user.
 * Strategy (in priority order):
 *   1. Products from top-affinity categories not yet purchased
 *   2. Collaborative filtering — find users with similar purchases
 *   3. Trending products the user hasn't seen
 *
 * @param {string} userId
 * @param {number} limit
 * @returns {Array} Array of Product documents
 */
async function generateRecommendations(userId, limit = 10) {
  const profile = await UserProfile.findOne({ userId });
  const recs = [];
  const seenIds = new Set();

  // Products already purchased — don't recommend again
  const purchasedIds = profile
    ? profile.productInteractions.filter(p => p.purchased).map(p => p.productId?.toString())
    : [];
  purchasedIds.forEach(id => seenIds.add(id));

  // ── Strategy 1: Category Affinity ─────────────────────────────────────────
  if (profile && profile.categoryAffinities.length > 0) {
    const topCategories = [...profile.categoryAffinities]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(a => a.category);

    const affinityProducts = await Product.find({
      category: { $in: topCategories },
      _id: { $nin: purchasedIds },
      isActive: true,
      stock: { $gt: 0 },
    })
      .sort({ trendScore: -1, rating: -1 })
      .limit(limit);

    for (const p of affinityProducts) {
      if (!seenIds.has(p._id.toString())) {
        recs.push({ ...p.toObject(), recommendReason: `Based on your interest in ${p.category}` });
        seenIds.add(p._id.toString());
      }
    }
  }

  // ── Strategy 2: Collaborative Filtering (lightweight) ─────────────────────
  // Find other users who bought similar products, then recommend what they also bought
  if (recs.length < limit && profile && profile.productInteractions.length > 0) {
    const userProductIds = profile.productInteractions
      .filter(p => p.purchased || p.addedToCart)
      .map(p => p.productId);

    if (userProductIds.length > 0) {
      // Find users who interacted with the same products
      const similarUsers = await UserProfile.find({
        userId: { $ne: userId },
        'productInteractions.productId': { $in: userProductIds },
        'productInteractions.purchased': true,
      }).limit(20);

      // Collect products purchased by similar users
      const collaborativeProductIds = new Set();
      for (const su of similarUsers) {
        for (const pi of su.productInteractions) {
          if (pi.purchased && !seenIds.has(pi.productId?.toString())) {
            collaborativeProductIds.add(pi.productId?.toString());
          }
        }
      }

      if (collaborativeProductIds.size > 0) {
        const collabProducts = await Product.find({
          _id: { $in: [...collaborativeProductIds] },
          isActive: true,
          stock: { $gt: 0 },
        }).limit(limit - recs.length);

        for (const p of collabProducts) {
          if (!seenIds.has(p._id.toString())) {
            recs.push({ ...p.toObject(), recommendReason: 'Customers like you also bought this' });
            seenIds.add(p._id.toString());
          }
        }
      }
    }
  }

  // ── Strategy 3: Trending Products Fallback ────────────────────────────────
  if (recs.length < limit) {
    const trending = await Product.find({
      _id: { $nin: [...seenIds] },
      isActive: true,
      stock: { $gt: 0 },
    })
      .sort({ trendScore: -1 })
      .limit(limit - recs.length);

    for (const p of trending) {
      recs.push({ ...p.toObject(), recommendReason: 'Trending right now' });
    }
  }

  // Cache recommended IDs on the profile for quick lookup
  if (profile) {
    profile.recommendedProductIds = recs.slice(0, limit).map(p => p._id);
    await profile.save();
  }

  return recs.slice(0, limit);
}

/**
 * Recompute trending scores for all products.
 * trendScore = weighted sum of recent behavior events.
 * Should be called periodically (e.g. every hour via cron).
 *
 * @param {number} windowDays - Look-back window in days (default 7)
 */
async function recomputeTrendingScores(windowDays = 7) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Aggregate event weights per product in the time window
  const agg = await BehaviorEvent.aggregate([
    { $match: { createdAt: { $gte: since }, productId: { $ne: null } } },
    {
      $group: {
        _id: '$productId',
        viewScore:     { $sum: { $cond: [{ $eq: ['$eventType', 'view'] },        1.0, 0] } },
        cartScore:     { $sum: { $cond: [{ $eq: ['$eventType', 'add_to_cart'] }, 3.0, 0] } },
        purchaseScore: { $sum: { $cond: [{ $eq: ['$eventType', 'purchase'] },    5.0, 0] } },
      }
    },
    {
      $project: {
        trendScore: { $add: ['$viewScore', '$cartScore', '$purchaseScore'] }
      }
    }
  ]);

  // Bulk update products
  const bulkOps = agg.map(item => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: { trendScore: item.trendScore } }
    }
  }));

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
    console.log(`[BehaviorEngine] Updated trend scores for ${bulkOps.length} products`);
  }
}

/**
 * Get platform-wide behavioral analytics summary (for admin dashboard).
 */
async function getPlatformAnalytics() {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    eventsByType,
    topViewedProducts,
    topSearchQueries,
    activityByHour,
    conversionFunnel,
  ] = await Promise.all([
    // Event type distribution (last 7 days)
    BehaviorEvent.aggregate([
      { $match: { createdAt: { $gte: since7d } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Top 10 most viewed products
    Product.find({ isActive: true })
      .sort({ viewCount: -1 })
      .limit(10)
      .select('name category viewCount cartAddCount purchaseCount trendScore'),

    // Top search queries (last 30 days)
    BehaviorEvent.aggregate([
      { $match: { createdAt: { $gte: since30d }, eventType: 'search', query: { $ne: null } } },
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]),

    // Activity by hour of day (for heatmap)
    BehaviorEvent.aggregate([
      { $match: { createdAt: { $gte: since7d } } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } }
    ]),

    // Conversion funnel: views → cart → purchase
    BehaviorEvent.aggregate([
      { $match: { createdAt: { $gte: since30d } } },
      {
        $group: {
          _id: null,
          views:     { $sum: { $cond: [{ $eq: ['$eventType', 'view'] }, 1, 0] } },
          cartAdds:  { $sum: { $cond: [{ $eq: ['$eventType', 'add_to_cart'] }, 1, 0] } },
          purchases: { $sum: { $cond: [{ $eq: ['$eventType', 'purchase'] }, 1, 0] } },
        }
      }
    ]),
  ]);

  return {
    eventsByType,
    topViewedProducts,
    topSearchQueries,
    activityByHour,
    conversionFunnel: conversionFunnel[0] || { views: 0, cartAdds: 0, purchases: 0 },
  };
}

module.exports = {
  processEvent,
  generateRecommendations,
  recomputeTrendingScores,
  getPlatformAnalytics,
};
