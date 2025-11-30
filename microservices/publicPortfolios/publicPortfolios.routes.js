const express = require("express");
const router = express.Router();

const {
  getPublicPortfolios,
  getPortfolio,
  togglePublicPortfolio,
} = require("./publicPortfolios.controller");

// Routes
router.get("/public", getPublicPortfolios);
router.get("/:type/:id", getPortfolio);
router.patch("/:id/toggle-public", togglePublicPortfolio);

module.exports = router;
