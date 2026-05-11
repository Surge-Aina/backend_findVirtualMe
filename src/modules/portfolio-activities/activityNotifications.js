const User = require("../../shared/models/User");
const subUserEmails = require("../auth/guestLogin/subUserEmails");

/**
 * Look up the portfolio owner's email so we can notify them of new activity
 * requests. Returns null on any failure so we never block the API path.
 */
async function resolveOwnerEmail(portfolio) {
  try {
    if (!portfolio?.owner) return null;
    const owner = await User.findById(portfolio.owner)
      .select("email username name")
      .lean();
    if (!owner?.email) return null;
    return {
      email: owner.email,
      name: owner.username || owner.name || "Portfolio Owner",
    };
  } catch (err) {
    console.error("[activityNotifications] resolveOwnerEmail failed:", err?.message || err);
    return null;
  }
}

async function notifyOwnerOfNewActivityRequest({ portfolio, portfolioUser, activity }) {
  const owner = await resolveOwnerEmail(portfolio);
  if (!owner) return { skipped: true };
  return subUserEmails.sendOwnerActivityRequestEmail({
    ownerEmail: owner.email,
    ownerName: owner.name,
    portfolioTitle: portfolio?.title || "Your portfolio",
    subUserName: portfolioUser?.name || portfolioUser?.username || portfolioUser?.email || "A customer",
    subUserEmail: portfolioUser?.email || "",
    activity,
  });
}

async function notifySubUserOfActivityDecision({ portfolio, subUser, activity, previousStatus }) {
  if (!subUser?.email) return { skipped: true };
  return subUserEmails.sendSubUserActivityDecisionEmail({
    subUserEmail: subUser.email,
    subUserName: subUser.name || subUser.username || subUser.email,
    portfolioTitle: portfolio?.title || "Your portfolio",
    activity,
    previousStatus,
  });
}

module.exports = {
  notifyOwnerOfNewActivityRequest,
  notifySubUserOfActivityDecision,
};
