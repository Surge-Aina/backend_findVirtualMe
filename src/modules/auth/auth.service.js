const jwt = require("jsonwebtoken");
const { normalizeUserAppTheme } = require("../../shared/utils/userSerialize");

/**
 * Builds the same JSON body and session token as email/password login.
 */
function buildLoginSuccessPayload(user) {
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
  const portfolioIds = user.portfolios || [];

  return {
    message: "logged in successfully",
    token,
    user: normalizeUserAppTheme(user),
    portfolioIds,
  };
}

module.exports = {
  buildLoginSuccessPayload,
};