const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');

// GET /api/domains - Get user's domains
router.get("/:domain", (req, res, next) => {
  console.log("Domain route hit with domain:", req.params.domain);
  domainService.getDomain(req, res, next);
});

module.exports = router;
