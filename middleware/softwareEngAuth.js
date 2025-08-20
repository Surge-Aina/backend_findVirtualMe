const jwt = require('jsonwebtoken');

/**
 * Software Engineer Authentication middleware to verify JWT tokens
 * Supports both main JWT secret and software engineer specific JWT secret
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const softwareEngAuth = (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    let decoded;
    
    // Try to verify with software engineer JWT secret first
    try {
      decoded = jwt.verify(token, process.env.SOFTWARE_ENG_JWT_SECRET);
    } catch (softwareEngError) {
      // If that fails, try with the main JWT secret
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (mainError) {
        console.error('Both JWT secrets failed:', { softwareEngError, mainError });
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Add user data to request object
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Software Engineer Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = softwareEngAuth;

