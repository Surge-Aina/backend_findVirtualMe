const express = require("express");
const router = express.Router();
const {
  updateUserPortfolios,
  getPortfoliosByList,
  updateAllUsersPortfolios,
} = require("./userPortfoliosArray.controller");

const auth = require("../../../shared/middleware/auth");
const roleCheck = require("../../../shared/middleware/roleCheck");

router.patch("/", auth, updateUserPortfolios);

router.post("/by-list", auth, getPortfoliosByList);

router.patch("/sync-all", auth, roleCheck(["admin"]), updateAllUsersPortfolios);

module.exports = router;
