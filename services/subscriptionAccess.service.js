const Subscriptions = require("../models/Subscriptions");
const User = require("../models/User");
const Stripe = require("stripe");

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const DEFAULT_AGENT_EDIT_LIMIT = 30;
const PRO_AGENT_EDIT_LIMIT = 60;

const stripeSecretKey =
  process.env.STRIPE_MODE === "live"
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY_TEST;

const PRICE_MAP = {
  basic:
    process.env.STRIPE_MODE === "live"
      ? process.env.PRICE_BASIC_LIVE
      : process.env.PRICE_BASIC_TEST,
  pro:
    process.env.STRIPE_MODE === "live"
      ? process.env.PRICE_PRO_LIVE
      : process.env.PRICE_PRO_TEST,
};

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getUsagePeriodKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthlyAgentEditLimit(subscription) {
  const type = cleanString(subscription?.subscriptionType).toLowerCase();
  return type === "pro" ? PRO_AGENT_EDIT_LIMIT : DEFAULT_AGENT_EDIT_LIMIT;
}

function getNormalizedAgentEditUsage(user = {}, subscription = null) {
  const periodKey = getUsagePeriodKey();
  const usage = user?.aiUsage?.agentEdits || {};
  const activeUsage =
    usage.periodKey === periodKey
      ? {
          periodKey,
          used: Number.isFinite(usage.used) ? usage.used : 0,
          lastUsedAt: usage.lastUsedAt || null,
        }
      : {
          periodKey,
          used: 0,
          lastUsedAt: null,
        };

  const limit = subscription ? getMonthlyAgentEditLimit(subscription) : 0;
  return {
    periodKey,
    used: activeUsage.used,
    limit,
    remaining: Math.max(0, limit - activeUsage.used),
    lastUsedAt: activeUsage.lastUsedAt,
  };
}

async function getActiveSubscriptionFromMongo(user = {}) {
  const email = cleanString(user.email);
  const stripeCustomerId = cleanString(user.stripeCustomerId);
  const statusFilter = { $in: Array.from(ACTIVE_SUBSCRIPTION_STATUSES) };

  if (email) {
    const subscriptionByEmail = await Subscriptions.findOne({
      email: { $regex: `^${escapeRegex(email)}$`, $options: "i" },
      status: statusFilter,
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (subscriptionByEmail) return subscriptionByEmail;
  }

  if (!stripeCustomerId) return null;

  return Subscriptions.findOne({
    customerId: stripeCustomerId,
    status: statusFilter,
  })
    .sort({ updatedAt: -1 })
    .lean();
}

function resolveSubscriptionType(stripeSub) {
  const priceId = stripeSub.items?.data?.[0]?.price?.id;
  if (priceId === PRICE_MAP.basic) return "basic";
  if (priceId === PRICE_MAP.pro) return "pro";
  return "basic";
}

async function getActiveSubscriptionFromStripe(stripeCustomerId) {
  if (!stripeCustomerId || !stripeSecretKey) return null;

  try {
    const stripe = new Stripe(stripeSecretKey);
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });

    const activeSub = subs.data?.[0];
    if (!activeSub) return null;

    return {
      customerId: stripeCustomerId,
      subscriptionId: activeSub.id,
      status: activeSub.status,
      subscriptionType: resolveSubscriptionType(activeSub),
      _fromStripeApi: true,
    };
  } catch (err) {
    console.error("[AI-ACCESS] Stripe API fallback failed:", err.message);
    return null;
  }
}

async function getActiveSubscriptionForUser(user = {}) {
  const mongoSub = await getActiveSubscriptionFromMongo(user);
  if (mongoSub) return mongoSub;

  const stripeCustomerId = cleanString(user.stripeCustomerId);
  if (!stripeCustomerId) return null;

  console.log(`[AI-ACCESS] MongoDB miss for ${user.email}, falling back to Stripe API for customer ${stripeCustomerId}`);
  return getActiveSubscriptionFromStripe(stripeCustomerId);
}

async function getAiEditingAccess(user = {}) {
  const subscription = await getActiveSubscriptionForUser(user);
  const usage = getNormalizedAgentEditUsage(user, subscription);
  return {
    hasAccess: Boolean(subscription),
    subscription,
    usage,
  };
}

async function consumeAiEditCredit(userId, access = null) {
  if (!userId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  const resolvedAccess =
    access && access.subscription
      ? access
      : await getAiEditingAccess({
          _id: user._id,
          email: user.email,
          stripeCustomerId: user.stripeCustomerId,
          aiUsage: user.aiUsage,
        });

  if (!resolvedAccess.hasAccess) return resolvedAccess;

  const periodKey = getUsagePeriodKey();
  const currentUsage = user.aiUsage?.agentEdits || {};
  const nextUsed =
    currentUsage.periodKey === periodKey
      ? (Number.isFinite(currentUsage.used) ? currentUsage.used : 0) + 1
      : 1;

  const updatedAiUsage = {
    ...(user.aiUsage?.toObject?.() || user.aiUsage || {}),
    agentEdits: {
      periodKey,
      used: nextUsed,
      lastUsedAt: new Date(),
    },
  };

  await User.updateOne(
    { _id: user._id },
    { $set: { aiUsage: updatedAiUsage } }
  );

  user.aiUsage = updatedAiUsage;

  return {
    ...resolvedAccess,
    usage: getNormalizedAgentEditUsage(user, resolvedAccess.subscription),
  };
}

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  DEFAULT_AGENT_EDIT_LIMIT,
  PRO_AGENT_EDIT_LIMIT,
  getUsagePeriodKey,
  getMonthlyAgentEditLimit,
  getActiveSubscriptionForUser,
  getAiEditingAccess,
  consumeAiEditCredit,
};
