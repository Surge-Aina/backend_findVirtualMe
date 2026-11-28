const componentService = require("./component.service");
const portfolioService = require("./portfolio.service");
const { isSuperAdminUser } = require("../account-teams/superAdmin.service");

function actorIsPrivileged(user) {
  return portfolioService.isPortfolioAdmin(user) || isSuperAdminUser(user);
}

function sendComponentError(res, err, fallback) {
  if (err.name === "ComponentConfigError" || err.name === "FeatureComponentsError" || err.status) {
    return res.status(err.status || 400).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }
  console.error("component.controller error:", err);
  return res.status(500).json({ error: fallback });
}

async function denyUnlessOwner(req, res, siteId) {
  const userId = req.user?._id || req.user?.id;
  const isAdmin = actorIsPrivileged(req.user);
  const check = await portfolioService.assertPortfolioOwner(siteId, userId, {
    isAdmin,
    user: req.user,
  });
  if (!check.ok) {
    res.status(check.status).json({ error: check.error, code: check.status === 403 ? "forbidden" : "not_found" });
    return false;
  }
  return true;
}

exports.listComponents = async (req, res) => {
  try {
    const siteId = typeof req.query.siteId === "string" ? req.query.siteId.trim() : "";
    if (!siteId) {
      return res.status(400).json({
        error: "siteId query parameter is required",
        code: "SITE_ID_REQUIRED",
      });
    }
    if (!(await denyUnlessOwner(req, res, siteId))) return;

    const listed = await componentService.listAvailableComponents({
      ownerId: req.user._id || req.user.id,
      siteId,
      audience: "owner",
      isAdmin: actorIsPrivileged(req.user),
      actorUser: req.user,
    });
    if (!listed) return res.status(404).json({ error: "Portfolio not found" });

    const { siteId: _id, template, ...puckPayload } = listed;
    return res.json({
      success: true,
      siteId,
      template,
      ...puckPayload,
    });
  } catch (err) {
    return sendComponentError(res, err, "Failed to list components");
  }
};