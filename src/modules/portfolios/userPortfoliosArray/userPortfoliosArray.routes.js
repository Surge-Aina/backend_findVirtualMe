const express = require("express");
const router = express.Router();
const {
  updateUserPortfolios,
  getPortfoliosByList,
  updateAllUsersPortfolios,
} = require("./userPortfoliosArray.controller");

const auth = require("../../../shared/middleware/auth");

router.patch("/", auth, updateUserPortfolios);

router.post("/by-list", auth, getPortfoliosByList);

router.patch("/sync-all", updateAllUsersPortfolios);

module.exports = router;
