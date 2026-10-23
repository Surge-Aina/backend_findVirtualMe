const guestUserService = require("../guestLogin/guestUser.service");
const GuestUser = require("../guestLogin/guestUser.model");
const { assertPortfolioOwner } = require("../../portfolios/portfolio.service");
const { templateToPortfolioType } = require("../../../shared/utils/templateToPortfolioType");
const Portfolio = require("../../portfolios/models/Portfolio");

function isPlatformAdmin(user) {
  return user?.role === "admin";
}

/**
 * Portfolio owners may manage sub-users for portfolios they own.
 * Unified portfolios are checked first. Legacy ids that are not in that
 * collection fall back to the owner's portfolios array.
 */
async function assertCanManagePortfolio(portfolioId, user) {
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  if (isPlatformAdmin(user)) return { ok: true };
  if (!portfolioId) {
    return { ok: false, status: 400, error: "portfolioId is required" };
  }

  const userId = user._id || user.id;
  let check;
  try {
    check = await assertPortfolioOwner(portfolioId, userId);
  } catch (_err) {
    check = { ok: false, status: 404, error: "Portfolio not found" };
  }
  if (check.ok || check.status === 403) return check;

  const ownedLegacy = (user.portfolios || []).some(
    (entry) => String(entry.portfolioId) === String(portfolioId)
  );
  if (ownedLegacy) return { ok: true };
  return { ok: false, status: 403, error: "Forbidden" };
}

exports.getAllUsers = async (req, res) => {
  try {
    const actor = req.user;
    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { portfolioId } = req.query;
    if (!isPlatformAdmin(actor)) {
      const check = await assertCanManagePortfolio(portfolioId, actor);
      if (!check.ok) {
        return res.status(check.status).json({ success: false, message: check.error });
      }
    }

    const result = await guestUserService.getAllUsers(portfolioId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || "Failed to fetch users",
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error in guestUser.controller for getAllUsers():", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Owner-only: create a sub-user account for a portfolio they own.
 * portfolioType is derived from the portfolio's template if not provided.
 */
exports.createUserAsOwner = async (req, res) => {
  try {
    const ownerUserId = req.user?._id || req.user?.id;
    const { portfolioId } = req.body || {};
    if (!portfolioId) {
      return res.status(400).json({ success: false, message: "portfolioId is required" });
    }
    const check = await assertPortfolioOwner(portfolioId, ownerUserId);
    if (!check.ok) {
      return res.status(check.status).json({ success: false, message: check.error });
    }

    let portfolioType = req.body.portfolioType;
    if (!portfolioType) {
      const portfolio = await Portfolio.findById(portfolioId).select("template").lean();
      portfolioType = portfolio ? templateToPortfolioType(portfolio.template) : null;
    }

    const payload = { ...(req.body || {}) };
    for (const key of Object.keys(payload)) {
      if (key.startsWith("$")) delete payload[key];
    }
    delete payload.role;
    delete payload.isAdmin;

    const newUser = await guestUserService.createNewUser({
      ...payload,
      portfolioId,
      portfolioType,
    });

    return res.status(201).json({ success: true, data: newUser });
  } catch (err) {
    console.error("Error in guestAdminPanel.controller for createUserAsOwner():", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to create sub-user" });
  }
};

exports.editUser = async (req, res) => {
  try {
    const actor = req.user;
    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = req.params.id;
    if (!isPlatformAdmin(actor)) {
      const existing = await GuestUser.findById(userId).select("portfolioId");
      if (!existing) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      const check = await assertCanManagePortfolio(existing.portfolioId, actor);
      if (!check.ok) {
        return res.status(check.status).json({ success: false, message: check.error });
      }
    }

    const source = req.body && typeof req.body === "object" ? req.body : {};
    const updatedInfo = {};
    const blocked = new Set(["password", "role", "isAdmin", "portfolioId", "_id", "id"]);
    for (const [key, value] of Object.entries(source)) {
      if (key.startsWith("$") || blocked.has(key)) continue;
      updatedInfo[key] = value;
    }

    const user = await guestUserService.updateUser({ userId, updatedInfo });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (err) {
    console.error("Error in guestAdminPanel.controller for editUser():", err);
    res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
