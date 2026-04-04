const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  price: { type: Number, default: 0 },
  date: { type: String, required: true }, // YYYY-MM-DD — which date this request is for
}, { timestamps: true });

module.exports = mongoose.model('Request', requestSchema);
