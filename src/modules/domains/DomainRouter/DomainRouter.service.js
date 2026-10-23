const DomainRoute = require("./DomainRouter.model");
const { normalizeDomain, getPortfolioMeta } = require("./utils/domainHelpers");

exports.createDomainMapping = async ({
  domain,
  user,
  portfolioId = null,
  notes = null
}) => {
  if (!domain) {
    throw new Error("Domain is required");
  }

  const userId = user._id;
  const normalizedDomain = normalizeDomain(domain);

  let portfolioType = null;

  if (portfolioId) {
    const portfolio = getPortfolioMeta(user, portfolioId);
    if (!portfolio) {
      const err = new Error("You do not own this portfolio");
      err.status = 403;
      throw err;
    }
    portfolioType = portfolio.portfolioType;
  }

  const existing = await DomainRoute.findOne({
    domain: normalizedDomain,
    isActive: true
  });

  if (existing) {
    const err = new Error("Domain already mapped");
    err.status = 409;
    throw err;
  }

  return DomainRoute.create({
    domain: normalizedDomain,
    userId,
    portfolioId,
    portfolioType,
    notes,
    createdBy: userId,
    updatedBy: userId
  });
};
