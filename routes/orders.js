const express = require('express');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/orders — user places an order for today
router.post('/', authenticate, async (req, res) => {
  try {
    const { date, items } = req.body;
    if (!date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Date and at least one item are required.' });
    }

    // Check if menu exists and is open
    const menu = await Menu.findOne({ date });
    if (!menu) {
      return res.status(400).json({ error: 'No menu available for this date.' });
    }
    if (!menu.isOpen) {
      return res.status(400).json({ error: 'Mess is closed for this date.' });
    }

    // Check cutoff time (only for today's date)
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      const now = new Date();
      const cutoffHour = parseInt(process.env.CUTOFF_HOUR || '11', 10);
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset
      const istNow = new Date(now.getTime() + istOffset);
      if (istNow.getUTCHours() >= cutoffHour) {
        return res.status(400).json({ 
          error: `Order cutoff time is ${cutoffHour}:00 AM IST. You can no longer order for today.` 
        });
      }
    }

    // Check for duplicate order
    const existing = await Order.findOne({ userId: req.user.id, date });
    if (existing) {
      return res.status(400).json({ error: 'You have already placed an order for this date.' });
    }

    // Validate items against menu
    const menuItemMap = {};
    menu.items.forEach(item => { menuItemMap[item.name.toLowerCase()] = item.price; });

    const validatedItems = [];
    for (const item of items) {
      const price = menuItemMap[item.name.toLowerCase()];
      if (price === undefined) {
        return res.status(400).json({ error: `Item "${item.name}" is not on today's menu.` });
      }
      validatedItems.push({ name: item.name, price });
    }

    const totalAmount = validatedItems.reduce((sum, item) => sum + item.price, 0);

    const order = await Order.create({
      userId: req.user.id,
      date,
      items: validatedItems,
      totalAmount,
    });

    res.status(201).json(order);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Duplicate order for this date.' });
    }
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/orders — get orders (own for users, all for admin)
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
    if (req.query.date) filter.date = req.query.date;
    if (req.query.userId && req.user.role === 'admin') filter.userId = req.query.userId;

    // Filter by month (YYYY-MM)
    if (req.query.month) {
      filter.date = { $regex: `^${req.query.month}` };
    }

    const orders = await Order.find(filter)
      .populate('userId', 'name')
      .sort({ date: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/orders/:id — admin can delete an order
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
