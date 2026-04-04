const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/billing/monthly?month=YYYY-MM — monthly summary
router.get('/monthly', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter (YYYY-MM) is required.' });
    }

    let filter = { date: { $regex: `^${month}` } };

    // Non-admin users only see their own
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const orders = await Order.find(filter).populate('userId', 'name');

    // Group by user
    const userTotals = {};
    let grandTotal = 0;

    orders.forEach(order => {
      const userName = order.userId?.name || 'Unknown';
      const userId = order.userId?._id?.toString() || 'unknown';

      if (!userTotals[userId]) {
        userTotals[userId] = { name: userName, total: 0, orderCount: 0, orders: [] };
      }
      userTotals[userId].total += order.totalAmount;
      userTotals[userId].orderCount += 1;
      userTotals[userId].orders.push({
        date: order.date,
        items: order.items,
        totalAmount: order.totalAmount,
      });
      grandTotal += order.totalAmount;
    });

    res.json({
      month,
      grandTotal,
      userSummaries: Object.values(userTotals),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/billing/export?month=YYYY-MM — export monthly bill as HTML
router.get('/export', authenticate, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return res.status(400).json({ error: 'Month parameter (YYYY-MM) is required.' });
    }

    let filter = { date: { $regex: `^${month}` } };
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const orders = await Order.find(filter).populate('userId', 'name').sort({ date: 1 });

    // Group by user
    const userMap = {};
    let grandTotal = 0;
    orders.forEach(order => {
      const name = order.userId?.name || 'Unknown';
      if (!userMap[name]) userMap[name] = { orders: [], total: 0 };
      userMap[name].orders.push(order);
      userMap[name].total += order.totalAmount;
      grandTotal += order.totalAmount;
    });

    const monthName = new Date(month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Gurav Mess Bill — ${monthName}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a2e; }
      h1 { color: #e94560; border-bottom: 2px solid #e94560; padding-bottom: 10px; }
      h2 { color: #0f3460; margin-top: 30px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background: #0f3460; color: #fff; }
      tr:nth-child(even) { background: #f5f5f5; }
      .total-row { font-weight: bold; background: #fff3e0 !important; }
      .grand-total { font-size: 1.3em; color: #e94560; margin-top: 30px; padding: 15px; background: #fff3e0; border-radius: 8px; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>🍽️ Gurav Mess — Monthly Bill</h1>
    <p><strong>Month:</strong> ${monthName}</p>`;

    for (const [name, data] of Object.entries(userMap)) {
      html += `<h2>${name}</h2><table>
        <tr><th>Date</th><th>Items</th><th>Amount (₹)</th></tr>`;
      data.orders.forEach(o => {
        const itemStr = o.items.map(i => `${i.name} (₹${i.price})`).join(', ');
        html += `<tr><td>${o.date}</td><td>${itemStr}</td><td>₹${o.totalAmount}</td></tr>`;
      });
      html += `<tr class="total-row"><td colspan="2">Total</td><td>₹${data.total}</td></tr></table>`;
    }

    html += `<div class="grand-total">💰 Grand Total: ₹${grandTotal}</div>
    <p style="margin-top:20px;color:#888;font-size:0.85em;">Generated on ${new Date().toLocaleString('en-IN')}</p>
    </body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
