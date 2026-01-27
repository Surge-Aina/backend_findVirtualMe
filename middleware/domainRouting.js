// middleware/domainRouting.js
const DomainRouter = require("../microservices/DomainRouter/DomainRouter.model");

module.exports = async function domainRouting(req, res, next) {
  try {
    console.log("🌐 DOMAIN MIDDLEWARE");
    console.log("HOSTNAME:", req.hostname);
    console.log("ORIGINAL URL:", req.originalUrl);

    const host = req.hostname.toLowerCase();

    const route = await DomainRouter.findOne({
      domain: host,
      isActive: true,
    });

    console.log("DOMAIN MATCH:", route ? "FOUND" : "NONE");
    
    if (route) {
      req.domainContext = {
        domain: host,
        portfolioId: route.portfolioId,
      };
    } else {
      req.domainContext = null;
    }

    next();
  } catch (err) {
    console.error("Domain routing error:", err);
    next();
  }
};
