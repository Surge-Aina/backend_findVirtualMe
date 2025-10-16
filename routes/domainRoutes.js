const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');
const auth = require("../middleware/auth");

// GET /api/domains/check/:domain - Check domain availability
router.get("/check/:domain", auth, (req, res, next) => {
  domainService.getDomain(req, res, next);
});

// POST /api/domains/register - Register domain through platform
router.post("/register", auth, domainService.registerDomain);

// POST /api/domains/custom - Configure custom domain (BYOD)
router.post("/custom", auth, domainService.configureCustomDomain);


// GET /api/domains/myDomains - Get current user's domains (requires auth)
router.get("/myDomains", auth, domainService.getMyDomains);

// POST /api/domains/verify/:domain - Verify DNS configuration 
router.post("/verify/:domain", auth, domainService.verifyDNS);

// GET /api/domains/lookup/:domain - Lookup portfolio by custom domain (PUBLIC with rate limiting in service)
router.get("/lookup/:domain", domainService.lookupPortfolioByDomain);


module.exports = router;
