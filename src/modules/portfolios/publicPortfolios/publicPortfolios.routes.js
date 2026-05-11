const express = require("express");
const router = express.Router();

const {
  getPublicPortfolios,
  getPortfolio,
  togglePublicPortfolio,
  deletePortfolio,
} = require("./publicPortfolios.controller");
const auth = require("../../../shared/middleware/auth");
const optionalAuth = require("../../../shared/middleware/optionalAuth");

// Routes (mounted at /api/portfolios/public)
router.get("/list", getPublicPortfolios);
router.get("/:type/:id", optionalAuth, getPortfolio);
router.patch("/:id/toggle", togglePublicPortfolio);
router.delete("/:id", auth, deletePortfolio);

module.exports = router;
