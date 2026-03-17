const express = require("express");
const auth = require("../../middleware/auth");
const controller = require("./privacyPolicy.controller");

const router = express.Router();

// ----- public routes -----
// GET /privacy-policy/public/byPortfolio?portfolioId=PORTFOLIO_ID&type=PORTFOLIO_TYPE
router.get("/public/byPortfolio", controller.getPublicPrivacyPolicyByPortfolio);

// ----- protected routes -----
// Get all privacy policies for authenticated owner
router.get("/", auth, controller.getMyPrivacyPolicies);
// Get single privacy policy by id
router.get("/:id", auth, controller.getPrivacyPolicy);
// Create new privacy policy
router.post("/", auth, controller.createPrivacyPolicy);
// Update privacy policy by id
router.patch("/:id", auth, controller.updatePrivacyPolicy);
// Delete privacy policy by id
router.delete("/:id", auth, controller.deletePrivacyPolicy);

module.exports = router;

