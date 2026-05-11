const guestUserService = require("../guestLogin/guestUser.service");
const { assertPortfolioOwner } = require("../../portfolios/portfolio.service");
const { templateToPortfolioType } = require("../../../shared/utils/templateToPortfolioType");
const Portfolio = require("../../portfolios/models/Portfolio");

exports.getAllUsers = async (req, res) => {
  try {
       const { portfolioId } = req.query;
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

    const newUser = await guestUserService.createNewUser({
      ...req.body,
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
    const userId = req.params.id;
    const updatedInfo = req.body;

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
