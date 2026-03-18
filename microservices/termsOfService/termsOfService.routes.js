const express = require("express");
const auth = require("../../middleware/auth");
const controller = require("./termsOfService.controller");

const router = express.Router();

// ----- public routes -----
// GET /terms-of-service/public/byPortfolio?portfolioId=PORTFOLIO_ID&type=PORTFOLIO_TYPE
router.get("/public/byPortfolio", controller.getPublicTermsByPortfolio);

// ----- protected routes -----
router.get("/", auth, controller.getMyTermsOfService);
router.get("/:id", auth, controller.getTermsOfService);
router.post("/", auth, controller.createTermsOfService);
router.patch("/:id", auth, controller.updateTermsOfService);
router.delete("/:id", auth, controller.deleteTermsOfService);

module.exports = router;
