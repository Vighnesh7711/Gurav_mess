const express = require('express');
const Request = require('../models/Request');
const Menu = require('../models/Menu');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/requests — user creates a food request
router.post('/', authenticate, async (req, res) => {
  try {
    const { itemName, date } = req.body;
    if (!itemName || !date) {
      return res.status(400).json({ error: 'Item name and date are required.' });
    }

    const request = await Request.create({
      itemName: itemName.trim(),
      requestedBy: req.user.id,
      date,
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/requests — get all requests (admin) or own requests (user)
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { requestedBy: req.user.id };
    if (req.query.date) filter.date = req.query.date;
    if (req.query.status) filter.status = req.query.status;

    const requests = await Request.find(filter)
      .populate('requestedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/requests/:id/approve — admin approves and sets price
router.patch('/:id/approve', authenticate, adminOnly, async (req, res) => {
  try {
    const { price } = req.body;
    if (price == null || price < 0) {
      return res.status(400).json({ error: 'A valid price is required.' });
    }

    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed.' });
    }

    request.status = 'approved';
    request.price = price;
    await request.save();

    // Add approved item to the menu for that date
    let menu = await Menu.findOne({ date: request.date });
    if (menu) {
      menu.items.push({ name: request.itemName, price });
      await menu.save();
    } else {
      await Menu.create({
        date: request.date,
        items: [{ name: request.itemName, price }],
        isOpen: true,
      });
    }

    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/requests/:id/reject — admin rejects
router.patch('/:id/reject', authenticate, adminOnly, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed.' });
    }

    request.status = 'rejected';
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
