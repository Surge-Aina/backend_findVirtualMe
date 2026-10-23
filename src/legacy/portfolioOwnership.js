/**
 * Owner checks for legacy verticals whose documents hang off a portfolio.
 * Admins pass. Everyone else must own the portfolio the document belongs to.
 */
const mongoose = require("mongoose");
const User = require("../shared/models/User");
const UnifiedPortfolio = require("../modules/portfolios/models/Portfolio");
const DataScientistPortfolio = require("./data-scientist/models/DataScientistPortfolio");
const Photo = require("./photographer/models/photoModel");
const { templateToPortfolioType } = require("../shared/utils/templateToPortfolioType");

const SEEDED_DATA_SCIENTIST_EMAIL = "datascientist@example.com";

function isAdmin(user) {
  return user?.role === "admin";
}

function emailsMatch(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a) && a === b;
}

function portfolioIdFromRequest(req) {
  const body = req.body;
  if (body && typeof body === "object" && !Array.isArray(body) && body.portfolioId) {
    return String(body.portfolioId).trim();
  }
  if (req.query?.portfolioId) return String(req.query.portfolioId).trim();
  if (req.params?.portfolioId) return String(req.params.portfolioId).trim();
  return "";
}

async function userOwnsConcretePortfolio(user, portfolioId) {
  const id = String(portfolioId || "").trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return false;

  const unified = await UnifiedPortfolio.findById(id).select("owner").lean();
  if (unified) return String(unified.owner) === String(user._id);

  const fresh = await User.findById(user._id).select("portfolios").lean();
  return Boolean(fresh?.portfolios?.some((entry) => String(entry.portfolioId) === id));
}

async function ownedPortfolioMatchesTemplate(user, portfolioId, template) {
  const id = String(portfolioId || "").trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return false;
  const type = templateToPortfolioType(template);
  const unified = await UnifiedPortfolio.findById(id).select("owner template").lean();
  if (unified) {
    return String(unified.owner) === String(user._id) && unified.template === template;
  }
  const fresh = await User.findById(user._id).select("portfolios").lean();
  return Boolean(
    fresh?.portfolios?.some(
      (entry) =>
        String(entry.portfolioId) === id &&
        (entry.portfolioType === type || entry.portfolioType === template),
    ),
  );
}

async function userOwnsAnyTemplate(user, template) {
  const type = templateToPortfolioType(template);
  const unified = await UnifiedPortfolio.exists({ owner: user._id, template });
  if (unified) return true;
  return Boolean(
    await User.exists({
      _id: user._id,
      portfolios: { $elemMatch: { portfolioType: { $in: [type, template] } } },
    }),
  );
}

async function isSoleTemplateOwner(user, template) {
  if (!(await userOwnsAnyTemplate(user, template))) return false;
  const type = templateToPortfolioType(template);
  const otherUnified = await UnifiedPortfolio.exists({
    template,
    owner: { $ne: user._id },
  });
  if (otherUnified) return false;
  const otherLinked = await User.exists({
    _id: { $ne: user._id },
    portfolios: { $elemMatch: { portfolioType: { $in: [type, template] } } },
  });
  return !otherLinked;
}

/**
 * A real portfolio id must belong to the caller.
 * A non-id bucket such as the photographer "default" key is allowed only when
 * the caller is the only owner of that template, so one site can keep using
 * the legacy key without letting every customer write it.
 */
async function callerMayUsePortfolioId(user, portfolioId, template) {
  const id = String(portfolioId || "").trim();
  if (!id) {
    return { ok: false, status: 400, message: "portfolioId is required" };
  }
  if (await userOwnsConcretePortfolio(user, id)) {
    return { ok: true, portfolioId: id };
  }
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  if (template && (await isSoleTemplateOwner(user, template))) {
    return { ok: true, portfolioId: id };
  }
  return { ok: false, status: 403, message: "Forbidden" };
}

function deny(res, status, message) {
  if (status === 401) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  return res.status(status).json({ message });
}

async function requireDataScientistOwner(req, res, next) {
  try {
    if (!req.user) return deny(res, 401);
    if (isAdmin(req.user)) return next();

    const explicit = portfolioIdFromRequest(req);
    if (explicit && (await ownedPortfolioMatchesTemplate(req.user, explicit, "dataScientist"))) {
      return next();
    }

    const doc = await DataScientistPortfolio.findOne().select("email").lean();
    if (!doc) {
      if (await userOwnsAnyTemplate(req.user, "dataScientist")) return next();
      return deny(res, 403, "Forbidden");
    }
    if (emailsMatch(doc.email, req.user.email)) return next();

    const fresh = await User.findById(req.user._id).select("portfolios").lean();
    if (fresh?.portfolios?.some((entry) => String(entry.portfolioId) === String(doc._id))) {
      return next();
    }
    if (
      emailsMatch(doc.email, SEEDED_DATA_SCIENTIST_EMAIL) &&
      (await isSoleTemplateOwner(req.user, "dataScientist"))
    ) {
      return next();
    }
    return deny(res, 403, "Forbidden");
  } catch (err) {
    console.error("requireDataScientistOwner error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function requirePhotographerPortfolioOwner(req, res, next) {
  try {
    if (!req.user) return deny(res, 401);
    if (isAdmin(req.user)) {
      const id = portfolioIdFromRequest(req);
      if (id) req.ownedPortfolioId = id;
      return next();
    }

    let portfolioId = portfolioIdFromRequest(req);

    if (req.params?.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
      const photo = await Photo.findById(req.params.id).select("portfolioId");
      if (!photo) return res.status(404).json({ message: "Photo not found" });
      if (photo.portfolioId) portfolioId = String(photo.portfolioId);
    } else if (Array.isArray(req.body) && req.body.length) {
      const ids = req.body
        .map((photo) => photo && photo._id)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (ids.length) {
        const photos = await Photo.find({ _id: { $in: ids } }).select("portfolioId");
        const bound = [...new Set(photos.map((photo) => photo.portfolioId).filter(Boolean).map(String))];
        if (bound.length > 1) return deny(res, 403, "Forbidden");
        if (bound.length === 1) portfolioId = bound[0];
      }
    }

    const decision = await callerMayUsePortfolioId(req.user, portfolioId, "photographer");
    if (!decision.ok) return deny(res, decision.status, decision.message);
    req.ownedPortfolioId = decision.portfolioId;
    return next();
  } catch (err) {
    console.error("requirePhotographerPortfolioOwner error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  isAdmin,
  emailsMatch,
  portfolioIdFromRequest,
  userOwnsConcretePortfolio,
  requireDataScientistOwner,
  requirePhotographerPortfolioOwner,
  SEEDED_DATA_SCIENTIST_EMAIL,
};
