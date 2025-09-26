/**
 * Role-based access control middleware
 * @param {Array} roles - Array of allowed roles
 * @returns {Function} Express middleware function
 */
const jwt = require("jsonwebtoken");

const roleCheck = (roles) => {
  return (req, res, next) => {
    // Extract token from Authorization header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ error: "Token expired" });
    }
    if (!roles.includes(decoded.role)) {
      return res.status(403).json({
        error: "Access denied. Insufficient permissions.",
      });
    }

    next();
  };
};

module.exports = roleCheck;
