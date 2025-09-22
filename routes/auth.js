// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth'); // ✅ destructure the function

const router = express.Router();

const signToken = (user, secret) =>
  jwt.sign(
    {
      id: user._id.toString(),        // canonical id
      userId: user._id.toString(),    // alias for compatibility
      email: user.email,
      role: user.role || 'customer',
    },
    secret,
    { expiresIn: '24h' }
  );

/**
 * POST /auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = (req.body || {});
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user, process.env.JWT_SECRET);

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        // keep existing behavior if your FE expects this for lookups
        ownerId: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /auth/software-eng-login
 * Uses a separate secret if you require it.
 */
router.post('/software-eng-login', async (req, res) => {
  try {
    const { email, password } = (req.body || {});
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const secret = process.env.SOFTWARE_ENG_JWT_SECRET || process.env.JWT_SECRET;
    const token = jwt.sign(
      {
        id: user._id.toString(),
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'customer',
        portfolioType: 'software_engineer',
      },
      secret,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        portfolioType: 'software_engineer',
        ownerId: user.email,
      },
    });
  } catch (error) {
    console.error('Software Engineer login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'customer' } = (req.body || {});
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const existing = await User.findOne({
      $or: [{ email: String(email).toLowerCase() }, { username }],
    });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      username,
      email: String(email).toLowerCase(),
      password: hashed,
      role,
    });

    const token = signToken(user, process.env.JWT_SECRET);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        ownerId: user.role === 'admin' ? 'gayathrinuthana' : user._id, // preserve your existing logic
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /auth/profile
 */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId; // support both keys
    if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /auth/user  (alias of /profile)
 */
router.get('/user', verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Invalid token payload' });

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json(user);
  } catch (error) {
    console.error('User error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /auth/logout  (stateless)
 */
router.post('/logout', verifyToken, async (_req, res) => {
  try {
    // stateless JWT logout: client deletes token; no server state
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
