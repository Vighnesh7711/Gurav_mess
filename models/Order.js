const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
  }],
  totalAmount: { type: Number, required: true },
}, { timestamps: true });

// Prevent duplicate orders for same user on same date
orderSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Order', orderSchema);
