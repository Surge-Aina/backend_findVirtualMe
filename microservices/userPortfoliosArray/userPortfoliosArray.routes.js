const express = require("express");
const router = express.Router();
const {
  updateUserPortfolios,
  getPortfoliosByList,
  updateAllUsersPortfolios,
} = require("./userPortfoliosArray.controller");

const auth = require("../../middleware/auth");

// Update the user's portfolios array
router.patch("/updateUserPortfolios", auth, updateUserPortfolios);

// Get portfolio documents from a list
router.post("/getPortfoliosByList", auth, getPortfoliosByList);

// Update portfolios array for all users (no auth required)
router.patch("/updateAllUsersPortfolios", updateAllUsersPortfolios);

module.exports = router;
