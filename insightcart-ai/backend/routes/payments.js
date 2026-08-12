/**
 * Payment Routes — /api/payments
 * Simulates a payment gateway with configurable success rate.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Order } = require('../models/Order');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/payments/process — Simulate payment for an order
router.post('/process', protect, async (req, res) => {
  try {
    const { orderId, cardNumber, expiryDate, cvv, cardHolder } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Access denied' });
    if (order.paymentStatus === 'paid')
      return res.status(400).json({ success: false, error: 'Order already paid' });

    // Simulate payment processing delay
    await new Promise(r => setTimeout(r, 800));

    // Simulate success/failure based on configured rate
    const successRate = parseFloat(process.env.PAYMENT_SUCCESS_RATE || '0.95');
    const isSuccess = Math.random() < successRate;

    // Basic card validation simulation
    const cardNum = (cardNumber || '').replace(/\s/g, '');
    if (cardNum.length < 13 || cardNum.length > 19) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card number',
        code: 'INVALID_CARD'
      });
    }

    if (isSuccess) {
      const paymentRef = `PAY-${uuidv4().toUpperCase().slice(0, 12)}`;
      order.paymentStatus = 'paid';
      order.paymentRef = paymentRef;
      order.status = 'processing';
      await order.save();

      res.json({
        success: true,
        message: 'Payment successful',
        paymentRef,
        order,
      });
    } else {
      order.paymentStatus = 'failed';
      await order.save();

      res.status(402).json({
        success: false,
        error: 'Payment declined by bank. Please check your card details.',
        code: 'PAYMENT_DECLINED',
        orderId,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments/refund — Admin: issue refund
router.post('/refund', protect, async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Only admin or order owner can refund
    if (req.user.role !== 'admin' && order.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, error: 'Access denied' });

    if (order.paymentStatus !== 'paid')
      return res.status(400).json({ success: false, error: 'Order is not paid — cannot refund' });

    order.paymentStatus = 'refunded';
    order.status = 'cancelled';
    order.notes = `${order.notes || ''} | REFUND: ${reason || 'Customer request'}`;
    await order.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refundRef: `REF-${uuidv4().toUpperCase().slice(0, 12)}`,
      order
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
