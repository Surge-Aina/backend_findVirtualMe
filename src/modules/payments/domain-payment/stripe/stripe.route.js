const express = require("express");
const router = express.Router();
const auth = require("../../../../shared/middleware/auth");

const stripeController = require("./stripe.controller");

// POST /api/payments/domain-checkout
router.post("/domain-checkout", auth, stripeController.createCheckoutSession);

router.get("/domain-pricecheck/:domain", stripeController.checkPriceAndAvailability);

module.exports = router;
