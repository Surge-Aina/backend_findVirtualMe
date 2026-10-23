const mongoose = require("mongoose");
const Portfolio = require("../portfolios/models/Portfolio");
const DomainRoute = require("../domains/DomainRouter/DomainRouter.model");
const User = require("../../shared/models/User");
const { normalizeDomain } = require("../domains/DomainRouter/utils/domainHelpers");
const { encodeCursor } = require("./cursor");
const { toPublicSite } = require("./siteView");
const { buildBusinessProfile } = require("./businessProfile");

const SITE_FIELDS = "title template slug visibility";
const PROFILE_FIELDS = "title template slug visibility sections themeTokens pageBannerDefaults updatedAt";

function emptyDomainMap(portfolioIds) {
  const map = new Map();
  for (const id of portfolioIds) map.set(String(id), []);
  return map;
}

function pushDomain(list, domain, status) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return;
  if (list.some((entry) => entry.domain === normalized)) return;
  list.push({ domain: normalized, status: status || "pending" });
}

async function loadDomains(ownerId, portfolioIds) {
  const map = emptyDomainMap(portfolioIds);
  if (portfolioIds.length === 0) return map;

  const user = await User.findById(ownerId).select("domains").lean();
  for (const entry of user?.domains || []) {
    const portfolioId = entry?.portfolioId ? String(entry.portfolioId) : "";
    const list = map.get(portfolioId);
    if (!list) continue;
    pushDomain(list, entry.domain, entry.status);
  }

  const routes = await DomainRoute.find({
    userId: ownerId,
    portfolioId: { $in: portfolioIds },
  })
    .select("domain portfolioId isActive")
    .lean();

  for (const route of routes) {
    const list = map.get(String(route.portfolioId));
    if (!list) continue;
    pushDomain(list, route.domain, route.isActive ? "active" : "inactive");
  }

  return map;
}

async function listSites({ ownerId, limit, cursor, onlySiteId }) {
  const filter = { owner: ownerId };
  if (onlySiteId) {
    if (!mongoose.isValidObjectId(onlySiteId)) {
      return { sites: [], hasMore: false, nextCursor: null };
    }
    filter._id = onlySiteId;
  } else if (cursor) filter._id = { $gt: cursor };

  const docs = await Portfolio.find(filter)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .select(SITE_FIELDS)
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  const domains = await loadDomains(
    ownerId,
    page.map((doc) => doc._id)
  );

  return {
    sites: page.map((doc) => toPublicSite(doc, domains.get(String(doc._id)) || [])),
    hasMore,
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]._id) : null,
  };
}

async function getSite({ ownerId, siteId }) {
  if (!mongoose.isValidObjectId(siteId)) return null;
  const doc = await Portfolio.findOne({ _id: siteId, owner: ownerId })
    .select(SITE_FIELDS)
    .lean();
  if (!doc) return null;
  const domains = await loadDomains(ownerId, [doc._id]);
  return toPublicSite(doc, domains.get(String(doc._id)) || []);
}

async function resolvePortfolio({ ownerId, siteId }) {
  if (siteId) {
    if (!mongoose.isValidObjectId(siteId)) return null;
    return Portfolio.findOne({ _id: siteId, owner: ownerId }).select(PROFILE_FIELDS).lean();
  }

  const published = await Portfolio.findOne({ owner: ownerId, visibility: "public" })
    .sort({ updatedAt: -1 })
    .select(PROFILE_FIELDS)
    .lean();
  if (published) return published;

  return Portfolio.findOne({ owner: ownerId })
    .sort({ updatedAt: -1 })
    .select(PROFILE_FIELDS)
    .lean();
}

async function getBusinessProfile({ ownerId, siteId }) {
  const portfolio = await resolvePortfolio({ ownerId, siteId });
  if (!portfolio) return null;
  return buildBusinessProfile(portfolio);
}

module.exports = {
  listSites,
  getSite,
  getBusinessProfile,
};
