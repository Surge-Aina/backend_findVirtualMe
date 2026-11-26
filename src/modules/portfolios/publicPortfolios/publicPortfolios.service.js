const portfolioService = require("../portfolio.service");
const { isSiteDraftsEnabled } = require("../../../shared/config/siteDrafts");

exports.getPublicPortfolios = async () => {
  try {
    const portfolios = await portfolioService.getPublicPortfolios();
    return portfolios;
  } catch (error) {
    console.log("getPublicPortfolios Error:", error);
    throw error;
  }
};

exports.getMyPortfolio = async (type, id, viewerUserId) => {
  try {
    return portfolioService.getPortfolioForViewer(id, viewerUserId);
  } catch (error) {
    console.log("getMyPortfolio Error:", error.message);
    throw error;
  }
};

exports.togglePublicPortfolio = async (portfolioId) => {
  try {
    if (isSiteDraftsEnabled()) {
      const result = await portfolioService.toggleVisibility(portfolioId);
      if (!result) return null;
      const doc = await portfolioService.getPortfolio(portfolioId);
      return {
        _id: result._id,
        isPublic: result.visibility === "public",
        portfolioType: doc?.template,
        draftMode: Boolean(result.draft),
      };
    }

    const result = await portfolioService.toggleVisibility(portfolioId);
    if (!result) return null;
    const doc = await portfolioService.getPortfolio(portfolioId);
    return {
      _id: result._id,
      isPublic: result.visibility === "public",
      portfolioType: doc?.template,
    };
  } catch (error) {
    console.error("togglePublicPortfolio Error:", error.message || "toggle failed");
    throw error;
  }
};

exports.deletePortfolio = async (portfolioId) => {
  try {
    return portfolioService.deletePortfolio(portfolioId);
  } catch (error) {
    console.error("deletePortfolio Error:", error.message || "delete failed");
    throw error;
  }
};