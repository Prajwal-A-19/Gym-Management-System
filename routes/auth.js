const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun } = require('../database');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

const SECRET = process.env.JWT_SECRET || 'gympro_secret_2024';

// Rate limiting helper (in-memory, resets on restart — use express-rate-limit in production)
const loginAttempts = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 15 * 60 * 1000; }
  entry.count++;
  loginAttempts.set(ip, entry);
  return entry.count > 20;
}

router.post('/login', async (req, res) => {
  const ip = req.ip;
  if (checkRateLimit(ip)) return res.status(429).json({ message: 'Too many login attempts. Try again in 15 minutes.' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password are required.' });
  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET, { expiresIn: '8h' });
    res.json({ token, role: user.role, username: user.username, id: user.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  const { username, password, first_name, last_name, email, phone, gender, date_of_birth } = req.body;
  // Server-side validation
  if (!username || !password || !first_name || !last_name || !email)
    return res.status(400).json({ message: 'First name, last name, email, username and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'Invalid email address.' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRes = await dbRun('INSERT INTO users (username, password_hash, role) VALUES (?, ?, "Member")', [username, hashedPassword]);
    await dbRun('INSERT INTO members (user_id, first_name, last_name, email, phone, gender, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userRes.lastID, first_name, last_name, email, phone || null, gender || null, date_of_birth || null]);
    res.status(201).json({ message: 'Registration successful! Please login.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE'))
      return res.status(400).json({ message: 'Username or Email already exists.' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/change-password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect.' });
    const newHash = await bcrypt.hash(new_password, 10);
    await dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
