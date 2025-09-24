const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');

// GET /api/domains/:domain - Check domain availability
router.get("/:domain", (req, res, next) => {
  console.log("Domain route hit with domain:", req.params.domain);
  domainService.getDomain(req, res, next);
});

// POST /api/domains/register - Register domain through platform
router.post("/register", domainService.registerDomain);

// POST /api/domains/custom - Configure custom domain (BYOD)
router.post("/custom", domainService.configureCustomDomain);

// GET /api/domains/user/:userId - Get user's domains
router.get("/user/:userId", domainService.getUserDomains);

module.exports = router;
