const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { isAccountTeamsEnabled } = require("../config/accountTeams");
const { buildSuperAdminUser } = require("../../modules/account-teams/superAdmin.service");

const optionalAuth = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return next();
    }

    if (decoded.kind === "super_admin" && isAccountTeamsEnabled()) {
      req.user = buildSuperAdminUser();
      return next();
    }
    const user = await User.findById(decoded.id || decoded._id).select("-password");
    if (user) {
      req.user = user;
    }

    return next();
  } catch (_error) {
    return next();
  }
};

module.exports = optionalAuth;
