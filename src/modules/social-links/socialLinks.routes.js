const express = require("express");
const { getSocialLinks, updateSocialLinks } = require("./socialLinks.controller.js");
const auth = require("../../shared/middleware/auth");

const router = express.Router();

router.get("/:portfolioId", getSocialLinks);
router.patch("/:portfolioId", auth, updateSocialLinks);

module.exports = router;
