const express = require("express");
const router = express.Router();
const auth = require("../../../middleware/auth");

const stripeController = require("./stripe.controller");

// 1. Endpoint for the frontend to initiate a payment session
// POST /api/domainPayment/checkout
router.post("/checkout", auth, stripeController.createCheckoutSession);

// New Route for Price/Availability Check
router.get("/pricecheck/:domain", stripeController.checkPriceAndAvailability);

module.exports = router;
