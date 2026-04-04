const express = require('express');
const PDFDocument = require('pdfkit');
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

// GET /api/billing/export-pdf?month=YYYY-MM — export monthly bill as PDF
router.get('/export-pdf', authenticate, async (req, res) => {
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

    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Gurav_Mess_Bill_${month}.pdf"`);
    doc.pipe(res);

    // -- Header --
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#e94560')
       .text('Gurav Mess', { align: 'center' });
    doc.fontSize(14).font('Helvetica').fillColor('#333333')
       .text('Monthly Bill Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#555555')
       .text(`Month: ${monthName}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#888888')
       .text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });

    // Divider line
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e94560').lineWidth(2).stroke();
    doc.moveDown(1);

    // -- Grand Total Box --
    const gtY = doc.y;
    doc.rect(50, gtY, 495, 45).fillAndStroke('#fff3e0', '#e94560');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#e94560')
       .text(`Grand Total: Rs. ${grandTotal}`, 60, gtY + 13, { width: 475, align: 'center' });
    doc.moveDown(2.5);

    // -- Per-user sections --
    const userEntries = Object.entries(userMap);

    for (let u = 0; u < userEntries.length; u++) {
      const [name, data] = userEntries[u];

      // Check if we need a new page
      if (doc.y > 650) doc.addPage();

      // User header
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f3460')
         .text(name, 50);
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
         .text(`${data.orders.length} orders | Total: Rs. ${data.total}`);
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const col1 = 50;   // Date
      const col2 = 150;  // Items
      const col3 = 460;  // Amount

      doc.rect(col1, tableTop, 495, 22).fill('#0f3460');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Date', col1 + 8, tableTop + 6, { width: 90 });
      doc.text('Items Ordered', col2 + 8, tableTop + 6, { width: 290 });
      doc.text('Amount', col3 + 8, tableTop + 6, { width: 70, align: 'right' });

      let rowY = tableTop + 22;

      // Table rows
      data.orders.forEach((order, idx) => {
        if (rowY > 720) {
          doc.addPage();
          rowY = 50;
        }

        const itemsStr = order.items.map(i => `${i.name} (Rs.${i.price})`).join(', ');
        const dateStr = new Date(order.date + 'T00:00:00').toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        });

        // Measure text height for items column
        const textHeight = doc.heightOfString(itemsStr, { width: 290 });
        const rowHeight = Math.max(textHeight + 10, 22);

        // Alternate row background
        if (idx % 2 === 0) {
          doc.rect(col1, rowY, 495, rowHeight).fill('#f8f9fa');
        } else {
          doc.rect(col1, rowY, 495, rowHeight).fill('#ffffff');
        }

        // Row borders
        doc.rect(col1, rowY, 495, rowHeight).strokeColor('#e0e0e0').lineWidth(0.5).stroke();

        doc.fontSize(9).font('Helvetica').fillColor('#333333');
        doc.text(dateStr, col1 + 8, rowY + 5, { width: 90 });
        doc.text(itemsStr, col2 + 8, rowY + 5, { width: 290 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f3460');
        doc.text(`Rs. ${order.totalAmount}`, col3 + 8, rowY + 5, { width: 70, align: 'right' });

        rowY += rowHeight;
      });

      // User total row
      if (rowY > 720) {
        doc.addPage();
        rowY = 50;
      }
      doc.rect(col1, rowY, 495, 24).fill('#fff3e0');
      doc.rect(col1, rowY, 495, 24).strokeColor('#e94560').lineWidth(1).stroke();
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#e94560');
      doc.text(`Total for ${name}`, col1 + 8, rowY + 6, { width: 390 });
      doc.text(`Rs. ${data.total}`, col3 + 8, rowY + 6, { width: 70, align: 'right' });

      doc.y = rowY + 24;
      doc.moveDown(1.5);
    }

    // -- Footer --
    if (doc.y > 700) doc.addPage();
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#999999')
       .text('Smart Mess Manager | Gurav Mess', 50, doc.y, { align: 'center', width: 495 });
    doc.text('This is a computer-generated bill.', { align: 'center', width: 495 });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
});

module.exports = router;
