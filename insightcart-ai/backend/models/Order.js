/**
 * CartItem Model — Persistent cart stored per user session
 */
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity:  { type: Number, default: 1, min: 1 },
}, { timestamps: true });

CartItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

const CartItem = mongoose.model('CartItem', CartItemSchema);

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Order Model — Finalized orders with full line items snapshot
 */
const OrderItemSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name:        String,
  price:       Number,
  quantity:    Number,
  imageUrl:    String,
});

const OrderSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items:    [OrderItemSchema],
  subtotal: { type: Number, required: true },
  tax:      { type: Number, default: 0 },
  total:    { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: { type: String, default: 'card' },
  paymentRef:    { type: String, default: null },
  shippingAddress: {
    street:  String,
    city:    String,
    state:   String,
    zip:     String,
    country: String,
  },
  notes: { type: String, default: '' },
}, { timestamps: true });

const Order = mongoose.model('Order', OrderSchema);

module.exports = { CartItem, Order };
