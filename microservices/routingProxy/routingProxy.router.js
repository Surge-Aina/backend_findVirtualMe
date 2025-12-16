// routes/routingProxy.js
const express = require("express");
const router = express.Router();
const DomainRewrite = require("../models/DomainRewrite"); // Your Mongoose model

router.get("/routing-proxy", async (req, res) => {
  try {
    // 1. Extract the custom domain and requested path
    const customDomain = req.query.host; // e.g., "dannizhou.me"
    const requestedPath = req.query.path || ""; // e.g., "gallery/photo1"

    // 2. Query MongoDB for the domain mapping
    const domainConfig = await DomainRewrite.findOne({
      domain: customDomain,
      status: "active",
    });

    // 3. Handle domain not found
    if (!domainConfig) {
      return res.status(404).json({
        error: "Domain not configured",
        domain: customDomain,
      });
    }

    // 4. Construct the final destination path
    // Example: domainConfig.portfolioPath = "/portfolios/ID-123"
    const finalDestinationPath = `${domainConfig.portfolioPath}/${requestedPath}`;

    // 5. Return routing information to the client
    return res.json({
      success: true,
      domain: customDomain,
      destinationPath: finalDestinationPath,
      portfolioId: domainConfig.portfolioId,
      originalPath: requestedPath,
    });
  } catch (error) {
    console.error("Routing proxy error:", error);
    return res.status(500).json({
      error: "Internal routing error",
    });
  }
});

module.exports = router;
