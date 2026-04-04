const express = require('express');
const Menu = require('../models/Menu');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/menu/:date — get menu for a specific date
router.get('/:date', authenticate, async (req, res) => {
  try {
    const menu = await Menu.findOne({ date: req.params.date });
    if (!menu) {
      return res.json({ date: req.params.date, items: [], isOpen: false, exists: false });
    }
    res.json({ ...menu.toObject(), exists: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/menu — create or update menu for a date (admin only)
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { date, items, isOpen } = req.body;
    if (!date || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Date and items array are required.' });
    }

    // Validate items
    for (const item of items) {
      if (!item.name || item.price == null || item.price < 0) {
        return res.status(400).json({ error: 'Each item must have a name and valid price.' });
      }
    }

    let menu = await Menu.findOne({ date });
    if (menu) {
      menu.items = items;
      menu.isOpen = isOpen !== undefined ? isOpen : menu.isOpen;
      await menu.save();
    } else {
      menu = await Menu.create({ date, items, isOpen: isOpen !== undefined ? isOpen : true });
    }

    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /api/menu/:date/toggle — toggle open/closed (admin only)
router.patch('/:date/toggle', authenticate, adminOnly, async (req, res) => {
  try {
    const menu = await Menu.findOne({ date: req.params.date });
    if (!menu) {
      return res.status(404).json({ error: 'Menu not found for this date.' });
    }
    menu.isOpen = !menu.isOpen;
    await menu.save();
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
