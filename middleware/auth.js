// middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Verifies a Bearer token and attaches { id, email, isAdmin } to req.user.
 * Returns 401 for missing/invalid tokens.
 */
const verifyToken = (req, res, next) => {
  try {
    // allow CORS preflight through without noise
    if (req.method === 'OPTIONS') return res.sendStatus(204);

    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (!token || (scheme && scheme.toLowerCase() !== 'bearer')) {
      return res.status(401).json({ message: 'Missing or invalid token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // normalize & trust the claims we sign at login
    req.user = {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      isAdmin: !!decoded.isAdmin,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed', error: err.message });
  }
};

/**
 * Requires admin. Returns 403 if the user isn’t an admin.
 */
const verifyAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access only' });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin };
