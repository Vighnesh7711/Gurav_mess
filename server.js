require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const requestRoutes = require('./routes/requests');
const orderRoutes = require('./routes/orders');
const billingRoutes = require('./routes/billing');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/billing', billingRoutes);

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Seed default admin and users if none exist
    const User = require('./models/User');
    const existingUsers = await User.countDocuments();
    if (existingUsers === 0) {
      const bcrypt = require('bcryptjs');
      const defaultUsers = [
        { name: 'kaki', password: await bcrypt.hash('kaki123', 10), role: 'admin' },
        { name: 'vighnesh', password: await bcrypt.hash('vighnesh123', 10), role: 'user' },
        { name: 'jay', password: await bcrypt.hash('jay123', 10), role: 'user' },
        { name: 'aadi', password: await bcrypt.hash('aadi123', 10), role: 'user' },
        { name: 'sagar', password: await bcrypt.hash('sagar123', 10), role: 'user' },
        { name: 'pratik', password: await bcrypt.hash('pratik123', 10), role: 'user' },
      ];
      await User.insertMany(defaultUsers);
      console.log('🌱 Seeded default users (admin: Kaki/kaki123)');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
