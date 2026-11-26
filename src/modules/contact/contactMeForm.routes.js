const express = require("express");
const router = express.Router();
const { createRateLimiter, clientIp } = require("../../shared/middleware/rateLimit");

const { submitContact } = require("./contactMeForm.controller");

const contactFormIpLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  name: "contact_form_ip",
  keyFn: clientIp,
});

router.post("/", contactFormIpLimit, submitContact);
router.post("/contactMeForm", contactFormIpLimit, submitContact);

module.exports = router;
module.exports.contactFormIpLimit = contactFormIpLimit;
