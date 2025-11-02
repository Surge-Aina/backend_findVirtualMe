const express = require("express");
const { getSocialLinks, updateSocialLinks } = require("./socialLinks.controller.js");

const router = express.Router();

router.get("/:portfolioId", getSocialLinks);
router.patch("/:portfolioId", updateSocialLinks);

module.exports = router;
