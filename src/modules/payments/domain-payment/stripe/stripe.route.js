const express = require("express");
const router = express.Router();
const auth = require("../../../../shared/middleware/auth");
const rejectComped = require("../../../../shared/middleware/rejectComped");

const stripeController = require("./stripe.controller");

// POST /api/payments/domain-checkout
router.post(
  ["/domain-checkout", "/checkout"],
  auth,
  rejectComped,
  stripeController.createCheckoutSession
);

router.get(
  ["/domain-pricecheck/:domain", "/pricecheck/:domain"],
  stripeController.checkPriceAndAvailability
);

module.exports = router;
