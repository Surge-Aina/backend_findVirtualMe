const Portfolio = require("../models/Portfolio");
const portfolioService = require("../portfolio.service");
const { notifySitePublished } = require("../../public-api/lifecycleEvents");

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
    const doc = await Portfolio.findById(portfolioId).select("visibility template owner");
    if (!doc) return null;

    doc.visibility = doc.visibility === "public" ? "private" : "public";
    await doc.save();
    if (doc.visibility === "public" && doc.owner) {
      notifySitePublished({ ownerId: doc.owner, siteId: doc._id, publishedAt: new Date() });
    }

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