const portfolioService = require("../portfolios/portfolio.service");
const User = require("../../shared/models/User");

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
    return {
      ok: false,
      status: 400,
      message:
        "A portfolioId, siteId, practiceId, or slug is required to deliver this message",
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
};