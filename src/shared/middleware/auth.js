const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isAccountTeamsEnabled } = require("../config/accountTeams");
const {
  buildSuperAdminUser,
  superAdminEnvConfigured,
} = require("../../modules/account-teams/superAdmin.service");
const { rejectUnlessSuperAdminPathAllowed } = require("../../modules/account-teams/superAdminScope");

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const auth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ error: "Token expired" });
    }
    if (decoded.kind === "super_admin") {
      if (!isAccountTeamsEnabled() || !superAdminEnvConfigured()) {
        return res.status(401).json({ error: "Invalid token" });
      }
      req.user = buildSuperAdminUser();
      if (!rejectUnlessSuperAdminPathAllowed(req, res)) return;
      return next();
    }
    const user = await User.findById(decoded.id || decoded._id).select(
      "-password"
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Add user data to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = auth;
