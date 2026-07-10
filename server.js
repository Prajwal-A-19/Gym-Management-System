const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Security headers
try { app.use(require('helmet')({ contentSecurityPolicy: false })); } catch(e) { console.warn('helmet not installed, skipping'); }

// CORS — restrict to same origin in production
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || `http://localhost:${process.env.PORT || 3000}`,
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trainer', require('./routes/trainer'));
app.use('/api/member', require('./routes/member'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 for unknown routes (not a catch-all that returns index.html)
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GymPro server running → http://localhost:${PORT}`));
