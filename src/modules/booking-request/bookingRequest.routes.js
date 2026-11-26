const express = require("express");
const { createRateLimiter, clientIp } = require("../../shared/middleware/rateLimit");
const { submitBookingRequest } = require("./bookingRequest.controller");

const router = express.Router();

const bookingRequestIpLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  name: "booking_request_ip",
  keyFn: clientIp,
});

router.post("/", bookingRequestIpLimit, submitBookingRequest);

module.exports = router;
module.exports.bookingRequestIpLimit = bookingRequestIpLimit;