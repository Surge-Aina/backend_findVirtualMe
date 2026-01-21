// middleware/domainRouting.js
const DomainRouter = require("../microservices/DomainRouter/DomainRouter.model");

module.exports = async function domainRouting(req, res, next) {
  try {
    const host = req.hostname.toLowerCase();

    const route = await DomainRouter.findOne({
      domain: host,
      isActive: true,
    });

    if (route) {
      req.domainContext = {
        domain: host,
        portfolioId: route.portfolioId,
        portfolioSlug: route.portfolioSlug || null,
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
