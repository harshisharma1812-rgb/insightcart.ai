/**
 * Behavior Routes — /api/behavior
 * Receives tracking events from the frontend Behavior Tracker.
 */
const express = require('express');
const { BehaviorEvent, UserProfile } = require('../models/BehaviorEvent');
const { processEvent } = require('../utils/behaviorEngine');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/behavior/events — Ingest one or more behavior events
router.post('/events', optionalAuth, async (req, res) => {
  try {
    // Accept single event or batch
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    const savedEvents = [];
    for (const eventData of payload) {
      const event = await BehaviorEvent.create({
        userId:    req.user?._id || null,
        sessionId: eventData.sessionId,
        eventType: eventData.eventType,
        productId: eventData.productId || null,
        category:  eventData.category || null,
        query:     eventData.query || null,
        dwellMs:   eventData.dwellMs || null,
        metadata:  eventData.metadata || {},
        ip:        req.ip,
        userAgent: req.headers['user-agent'],
      });
      savedEvents.push(event);

      // Process event asynchronously (don't block response)
      processEvent(event).catch(err =>
        console.error('[BehaviorEngine] processEvent error:', err.message)
      );
    }

    res.status(202).json({ success: true, processed: savedEvents.length });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/behavior/profile — Get current user's behavior profile
router.get('/profile', optionalAuth, async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ success: false, error: 'Login required' });

    const profile = await UserProfile.findOne({ userId: req.user._id })
      .populate('recommendedProductIds', 'name price imageUrl category rating');

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
