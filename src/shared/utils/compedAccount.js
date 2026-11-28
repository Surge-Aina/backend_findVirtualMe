function isCompedUser(user) {
  return Boolean(user?.comped);
}

function sendCompedBillingForbidden(res) {
  return res.status(403).json({
    code: "COMPED_ACCOUNT",
    message: "Comped accounts cannot use billing",
  });
}

function syntheticCompedSubscription(user = {}) {
  if (!isCompedUser(user)) return null;
  const plan = String(user.compedPlan || "")
    .trim()
    .toLowerCase();
  if (plan !== "basic" && plan !== "pro") return null;
  return {
    subscriptionType: plan,
    status: "active",
    _comped: true,
  };
}

function compedHasPaidPlan(user = {}) {
  const sub = syntheticCompedSubscription(user);
  return Boolean(sub);
}

module.exports = {
  isCompedUser,
  sendCompedBillingForbidden,
  syntheticCompedSubscription,
  compedHasPaidPlan,
};