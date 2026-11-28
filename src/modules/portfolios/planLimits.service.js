const Portfolio = require("./models/Portfolio");
const User = require("../../shared/models/User");
const { getActiveSubscriptionForUser } = require("../payments/subscription-access.service");

const FREE_PLAN_MAX_PORTFOLIOS = 1;

class PlanLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PlanLimitError";
    this.status = 402;
    this.code = "PLAN_LIMIT";
    this.details = details;
  }
}

async function resolvePortfolioLimit(user) {
  const subscription = await getActiveSubscriptionForUser(user);
  if (subscription) return { max: null, plan: subscription.subscriptionType || "paid" };
  return { max: FREE_PLAN_MAX_PORTFOLIOS, plan: "free" };
}

async function assertCanCreatePortfolio(ownerId) {
  const user = await User.findById(ownerId)
    .select("email stripeCustomerId comped compedPlan")
    .lean();

  const { max, plan } = user
    ? await resolvePortfolioLimit(user)
    : { max: FREE_PLAN_MAX_PORTFOLIOS, plan: "free" };
  if (max === null) return { plan, current: null, max: null };

  const current = await Portfolio.countDocuments({ owner: ownerId });
  if (current >= max) {
    throw new PlanLimitError("Free plan allows one portfolio. Upgrade to add more.", {
      plan,
      max,
      current,
    });
  }
  return { plan, current, max };
}

module.exports = {
  FREE_PLAN_MAX_PORTFOLIOS,
  PlanLimitError,
  resolvePortfolioLimit,
  assertCanCreatePortfolio,
};