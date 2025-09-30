// controllers/userController.js
const User = require('../models/userModel2.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const looksHashed = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

const signJwt = (user) =>
  jwt.sign(
    {
      id: user._id,
      email: user.email,
      isAdmin: user.isAdmin, // include role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

/**
 * SIGNUP
 * - Hashes password
 * - Allows setting isAdmin via body (only if you explicitly expose this endpoint).
 *   If this endpoint is public, you should *ignore* isAdmin from the body or restrict it server-side.
 */
const signupUser = async (req, res) => {
  try {
    const { email, password, isAdmin = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: hashed,
      isAdmin: Boolean(isAdmin),
    });

    const token = signJwt(user);
    return res.status(201).json({
      email: user.email,
      isAdmin: user.isAdmin,
      token,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

/**
 * LOGIN
 * - Supports both hashed (normal) and your current plaintext admin password (legacy).
 * - If a plaintext password is detected *and* login succeeds, it auto-upgrades it to a hash.
 */
const loginUser = async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields must be filled out' });
    }
    

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    let valid = false;

    if (looksHashed(user.password)) {
      // Stored as bcrypt hash (normal case)
      valid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plaintext support (your current admin)
      valid = password === user.password;

      // If valid and legacy plaintext, upgrade immediately to a hash
      if (valid) {
        try {
          const newHash = await bcrypt.hash(password, 10);
          user.password = newHash;
          await user.save();
        } catch {
          // If upgrade fails, still allow login but log the error on server if desired
        }
      }
    }

    if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

    const token = signJwt(user);
    return res.status(200).json({
      email: user.email,
      isAdmin: user.isAdmin,
      token,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

module.exports = { loginUser, signupUser };
