const portfolioService = require("../portfolios/portfolio.service");
const User = require("../../shared/models/User");

/** Sentinel site id for platform marketing / support contact leads (no portfolio). */
const PLATFORM_CONTACT_SITE_ID = "000000000000000000000000";

function hasPortfolioLookupKey(body = {}) {
  const portfolioIdRaw = body.portfolioId ?? body.siteId ?? body.practiceId;
  if (portfolioIdRaw !== undefined && portfolioIdRaw !== null && String(portfolioIdRaw).trim() !== "") {
    return true;
  }
  const slug =
    typeof body.slug === "string"
      ? body.slug.trim()
      : typeof body.portfolioSlug === "string"
        ? body.portfolioSlug.trim()
        : "";
  return slug.length > 0;
}

function resolvePlatformDeliveryTarget() {
  const ownerEmail = process.env.ADMIN_EMAIL;
  const ownerName = process.env.ADMIN_USERNAME || "FindVirtual.me";
  if (!ownerEmail) {
    return {
      ok: false,
      status: 503,
      message: "Platform contact delivery is not configured",
    };
  }
  return {
    ok: true,
    portfolioId: PLATFORM_CONTACT_SITE_ID,
    portfolioType: "platform",
    ownerEmail,
    ownerName,
    platformFallback: true,
  };
}

/**
 * Resolve the site owner for lead delivery. Never uses ownerEmail/ownerName from the request body.
 */
async function resolveContactDeliveryTarget(body = {}) {
  const portfolioIdRaw = body.portfolioId ?? body.siteId ?? body.practiceId;
  const slugRaw =
    typeof body.slug === "string"
      ? body.slug.trim()
      : typeof body.portfolioSlug === "string"
        ? body.portfolioSlug.trim()
        : "";

  let portfolio = null;
  if (portfolioIdRaw) {
    portfolio = await portfolioService.getPortfolio(portfolioIdRaw);
  } else if (slugRaw) {
    portfolio = await portfolioService.getPortfolioBySlug(slugRaw);
  }

  if (!portfolio) {
    if (!hasPortfolioLookupKey(body)) {
      return resolvePlatformDeliveryTarget();
    }
    return {
      ok: false,
      status: 400,
      message: "Could not resolve portfolio for this message",
    };
  }

  const ownerId = portfolio.owner;
  if (!ownerId) {
    return {
      ok: false,
      status: 400,
      message: "Could not resolve portfolio owner",
    };
  }

  const owner = await User.findById(ownerId).select("email name username").lean();
  const ownerEmail = owner?.email;
  const ownerName = owner?.name || owner?.username;
  if (!ownerEmail || !ownerName) {
    return {
      ok: false,
      status: 400,
      message: "Could not resolve portfolio owner contact",
    };
  }

  return {
    ok: true,
    portfolioId: String(portfolio._id),
    portfolioType: portfolio.template || body.portfolioType,
    ownerEmail,
    ownerName,
  };
}

module.exports = {
  resolveContactDeliveryTarget,
  PLATFORM_CONTACT_SITE_ID,
};