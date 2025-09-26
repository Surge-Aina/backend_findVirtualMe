const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * User login
 * @route   POST /auth/login
 * @param   {Object} req - Express request object with email and password
 * @param   {Object} res - Express response object
 * @returns {Object} JWT token and user data
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user exists in MongoDB
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.ownerId, 
        email: email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Return token and user data
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        ownerId: user.email // Use email as ownerId for portfolio lookup
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Software Engineer login
 * @route   POST /auth/software-eng-login
 * @param   {Object} req - Express request object with email and password
 * @param   {Object} res - Express response object
 * @returns {Object} JWT token and user data
 */
router.post('/software-eng-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user exists in MongoDB
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token using software engineer secret
    const token = jwt.sign(
      { 
        userId: user.ownerId, 
        email: email, 
        role: user.role,
        portfolioType: 'software_engineer'
      },
      process.env.SOFTWARE_ENG_JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Return token and user data
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        portfolioType: 'software_engineer',
        ownerId: user.email // Use email as ownerId for portfolio lookup
      }
    });
  } catch (error) {
    console.error('Software Engineer login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * User registration
 * @route   POST /auth/register
 * @param   {Object} req - Express request object with user data
 * @param   {Object} res - Express response object
 * @returns {Object} JWT token and user data
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role = 'customer' } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create new user
    const user = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role
    });
    
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Return token and user data (without password)
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        ownerId: user.role === 'admin' ? 'gayathrinuthana' : user._id
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get current user profile
 * @route   GET /auth/profile
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} Current user data
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get current user (alias for /profile)
 * @route   GET /auth/user
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} Current user data
 */
router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('User error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Logout (client-side token removal)
 * @route   POST /auth/logout
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @returns {Object} Success message
 */
router.post('/logout', auth, async (req, res) => {
  try {
    // In a stateless JWT system, logout is handled client-side
    // You could implement a blacklist here if needed
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 