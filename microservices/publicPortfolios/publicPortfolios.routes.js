const express = require("express");
const router = express.Router();

const {
  getPublicPortfolios,
  getPortfolio,
  togglePublicPortfolio,
  deletePortfolio,
} = require("./publicPortfolios.controller");
const auth = require("../../middleware/auth");

// Routes
router.get("/public", getPublicPortfolios);
router.get("/:type/:id", getPortfolio);
router.patch("/:id/toggle-public", togglePublicPortfolio);
router.delete("/:id", auth, deletePortfolio);

module.exports = router;
