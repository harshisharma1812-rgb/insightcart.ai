/**
 * User Model
 * Stores account credentials and role (customer / admin).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['customer', 'admin'], default: 'customer' },
  avatar:   { type: String, default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare plain password with hash
UserSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never send password field in JSON responses
UserSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.password; return ret; }
});

module.exports = mongoose.model('User', UserSchema);
