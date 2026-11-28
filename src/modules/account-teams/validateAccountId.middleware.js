const mongoose = require("mongoose");

function isValidAccountId(value) {
  return typeof value === "string" && value.trim() !== "" && mongoose.isValidObjectId(value);
}

function validateAccountIdParam(req, res, next) {
  const { accountId } = req.params;
  if (accountId === "super-admin") return next();
  if (!isValidAccountId(accountId)) {
    return res.status(400).json({ error: "Invalid account id", code: "INVALID_ACCOUNT_ID" });
  }
  return next();
}

function validateMembershipIdParam(req, res, next) {
  const { membershipId } = req.params;
  if (!isValidAccountId(membershipId)) {
    return res.status(400).json({ error: "Invalid membership id", code: "INVALID_MEMBERSHIP_ID" });
  }
  return next();
}

module.exports = {
  isValidAccountId,
  validateAccountIdParam,
  validateMembershipIdParam,
};