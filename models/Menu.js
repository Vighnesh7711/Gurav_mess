const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
  }],
  isOpen: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
