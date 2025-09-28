const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');
const auth = require("../middleware/auth");

// GET /api/domains/check/:domain - Check domain availability
router.get("/check/:domain", (req, res, next) => {
  console.log("Domain check route hit with domain:", req.params.domain);
  domainService.getDomain(req, res, next);
});

// POST /api/domains/register - Register domain through platform
router.post("/register", domainService.registerDomain);

// POST /api/domains/custom - Configure custom domain (BYOD)
router.post("/custom", domainService.configureCustomDomain);

// GET /api/domains/user/:userId - Get user's domains (requires authentication)
router.get("/user/:userId", auth, domainService.getUserDomains);

// GET /api/domains/my-domains - Get current user's domains (requires auth)
router.get("/my-domains", auth, domainService.getMyDomains);

// POST /api/domains/verify/:domain - Verify DNS configuration (placeholder)
router.post("/verify/:domain", (req, res) => {
  res.status(200).json({ 
    message: "DNS verification not yet implemented",
    domain: req.params.domain 
  });
});

module.exports = router;
