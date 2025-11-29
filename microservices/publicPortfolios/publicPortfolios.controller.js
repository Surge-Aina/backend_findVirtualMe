const express = require("express");
const {
  getPublicPortfolios,
  togglePublicPortfolio,
  getMyPortfolio,
} = require("./publicPortfolios.service");

// GET all public portfolios
exports.getPublicPortfolios = async (req, res) => {
  try {
    const portfolios = await getPublicPortfolios();
    res.json({ success: true, portfolios });
  } catch (err) {
    console.error("getPublicPortfoliosController Error:", err);
    res.status(500).json({ success: false, error: "Error getting public portfolios" });
  }
};
// GET my portfolio
exports.getPortfolio = async (req, res) => {
  try {
    const { type, id } = req.params;
    const result = await getMyPortfolio(type, id);

    if (!result) return res.status(404).json({ error: "Portfolio not found" });

    res.json(result);
  } catch (err) {
    console.log("getPortfolio error: ", err);
    res.status(500).json({ success: false, error: "Error getting my portfolio" });
  }
};

// PATCH toggle portfolio public status by portfolio ID
exports.togglePublicPortfolio = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await togglePublicPortfolio(id);

    if (!result)
      return res.status(404).json({ success: false, message: "Portfolio not found" });

    res.json({ success: true, portfolio: result });
  } catch (err) {
    console.error("togglePublicPortfolioController Error:", err);
    res.status(500).json({ success: false, error: "Error toggling public portfolio" });
  }
};
