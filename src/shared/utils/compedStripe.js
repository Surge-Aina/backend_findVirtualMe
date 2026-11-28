const Stripe = require("stripe");
const User = require("../models/User");
const Subscriptions = require("../models/Subscriptions");

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

const stripeSecretKey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

async function isCompedStripeCustomer(customerId) {
  const id = typeof customerId === "string" ? customerId.trim() : "";
  if (!id) return false;
  const user = await User.findOne({ stripeCustomerId: id }).select("comped").lean();
  return Boolean(user?.comped);
}

async function hasBlockingStripeSubscription(user = {}) {
  const email = normalizeEmail(user.email);
  const stripeCustomerId =
    typeof user.stripeCustomerId === "string" ? user.stripeCustomerId.trim() : "";

  const mongoFilter = { status: { $in: ACTIVE_SUBSCRIPTION_STATUSES } };
  const or = [];
  if (email) or.push({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } });
  if (stripeCustomerId) or.push({ customerId: stripeCustomerId });
  if (or.length) {
    const mongoSub = await Subscriptions.findOne({ $or: or, ...mongoFilter }).lean();
    if (mongoSub) return true;
  }

  if (!stripeCustomerId || !stripeSecretKey) return false;

  try {
    const stripe = new Stripe(stripeSecretKey);
    const listed = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 20,
    });
    return (listed.data || []).some((sub) =>
      ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status)
    );
  } catch (err) {
    console.error("[COMPED] Stripe subscription lookup failed:", err.message);
    return false;
  }
}

function sendActiveSubscriptionConflict(res) {
  return res.status(409).json({
    code: "HAS_ACTIVE_SUBSCRIPTION",
    message: "Cannot enable comped while an active or trialing Stripe subscription exists",
  });
}

async function loadCompedBillingExclusionSets() {
  const compedUsers = await User.find({ comped: true })
    .select("stripeCustomerId email")
    .lean();
  const customerIds = new Set();
  const emails = new Set();
  for (const row of compedUsers) {
    if (row.stripeCustomerId) customerIds.add(String(row.stripeCustomerId));
    const email = normalizeEmail(row.email);
    if (email) emails.add(email);
  }
  return { customerIds, emails };
}

function stripeSubMatchesCompedExclusion(stripeSub, exclusion) {
  const customerId = stripeSub?.customer?.id || stripeSub?.customer || "";
  if (customerId && exclusion.customerIds.has(String(customerId))) return true;
  const email = normalizeEmail(stripeSub?.customer?.email);
  return Boolean(email && exclusion.emails.has(email));
}

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  isCompedStripeCustomer,
  hasBlockingStripeSubscription,
  sendActiveSubscriptionConflict,
  loadCompedBillingExclusionSets,
  stripeSubMatchesCompedExclusion,
  normalizeEmail,
};