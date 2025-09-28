const express = require('express');
const router = express.Router();
const domainService = require('../services/domainService');

// GET /api/domains/check/:domain - Check domain availability
router.get("/check/:domain", (req, res, next) => {
  console.log("Domain check route hit with domain:", req.params.domain);
  domainService.getDomain(req, res, next);
});

// POST /api/domains/register - Register domain through platform
router.post("/register", domainService.registerDomain);

// POST /api/domains/custom - Configure custom domain (BYOD)
router.post("/custom", domainService.configureCustomDomain);

// GET /api/domains/user/:userId - Get user's domains
router.get("/user/:userId", domainService.getUserDomains);

// GET /api/domains/my-domains - Get current user's domains (requires auth)
router.get("/my-domains", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    
    const User = require('../models/User');
    const user = await User.findById(userId).select('domains portfolios email username');
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      },
      domains: user.domains || [],
      portfolios: user.portfolios || [],
      message: "User domains retrieved successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/domains/verify/:domain - Verify DNS configuration (placeholder)
router.post("/verify/:domain", (req, res) => {
  res.status(200).json({ 
    message: "DNS verification not yet implemented",
    domain: req.params.domain 
  });
});

module.exports = router;
