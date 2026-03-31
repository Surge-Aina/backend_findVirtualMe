const Portfolio = require("../../models/portfolio/Portfolio");
const portfolioService = require("../../services/portfolio.service");

exports.getPublicPortfolios = async () => {
  try {
    const portfolios = await Portfolio.find({ visibility: "public" }).lean();
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
    const doc = await Portfolio.findById(portfolioId).select("visibility template");
    if (!doc) return null;

    doc.visibility = doc.visibility === "public" ? "private" : "public";
    await doc.save();

    return {
      _id: doc._id,
      isPublic: doc.visibility === "public",
      portfolioType: doc.template,
    };
  } catch (error) {
    console.error("togglePublicPortfolio Error:", error);
    throw error;
  }
};

exports.deletePortfolio = async (portfolioId) => {
  try {
    const doc = await Portfolio.findByIdAndDelete(portfolioId);
    if (!doc) return null;
    return { _id: doc._id };
  } catch (error) {
    console.error("deletePortfolio Error:", error);
    throw error;
  }
};