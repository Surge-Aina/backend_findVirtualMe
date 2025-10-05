/**
 * Custom Domain Handler Middleware
 * 
 * This middleware intercepts requests from custom domains and returns
 * portfolio data instead of the full site. It should be placed AFTER
 * domainResolver middleware but BEFORE regular routes.
 * 
 * When a user visits their custom domain (e.g., johnsmith.com), this
 * returns their portfolio data as if they visited:
 * https://findvirtual.me/portfolios/project-manager/johnsmith/portfolioId
 */

const customDomainHandler = async (req, res, next) => {
  // If this is a custom domain request
  if (req.isCustomDomain && req.customDomainPortfolioId) {
    // Skip for API routes, static assets, and special paths
    const skipPaths = [
      '/api/',
      '/auth/',
      '/uploads/',
      '/health',
      '/stripe-webhook',
      '/checkout',
      '/user/',
      '/settings/',
      '/drive/',
      '/photo/',
      '/upload/',
      '/testimonials/',
      '/dashboard/',
      '/banner/',
      '/about/',
      '/menu/',
      '/gallery/',
      '/reviews/',
      '/tagged/',
      '/vendor/',
      '/datascience-portfolio/',
      '/portfolio/',
      '/softwareeng/',
      '/cleaning/',
      '/services/',
      '/quotes/',
      '/rooms/',
      '/support-form/',
      '/subscriptions/',
    ];

    const shouldSkip = skipPaths.some(path => req.path.startsWith(path));

    if (shouldSkip) {
      return next();
    }

    // Return portfolio data
    const portfolioInfo = {
      customDomain: true,
      domain: req.customDomain,
      portfolioId: req.customDomainPortfolioId,
      portfolioType: req.customDomainPortfolioType,
      user: {
        id: req.customDomainUser._id,
        username: req.customDomainUser.username,
        firstName: req.customDomainUser.firstName,
        lastName: req.customDomainUser.lastName,
        industry: req.customDomainUser.industry,
      },
      message: 'Custom domain detected - portfolio should be rendered',
    };

    console.log(`Custom domain handler: serving portfolio for ${req.customDomain}`);
    
    return res.status(200).json(portfolioInfo);
  }

  // Not a custom domain, continue normally
  next();
};

module.exports = customDomainHandler;
