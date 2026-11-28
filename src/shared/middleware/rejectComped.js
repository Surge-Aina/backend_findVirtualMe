const {
  isCompedUser,
  sendCompedBillingForbidden,
} = require("../utils/compedAccount");

function rejectComped(req, res, next) {
  if (isCompedUser(req.user)) {
    return sendCompedBillingForbidden(res);
  }
  return next();
}

module.exports = rejectComped;