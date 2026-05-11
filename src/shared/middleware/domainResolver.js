const User = require('../models/User');


// this file is used to resolve the domain of the user
// ie a user visits johnsmith.com, we need to resolve the domain to the user's portfolio
// instead of johnsmith.com -> findvirtualme.com it should be johnsmith.com -> johnsmith.com with the portfolio app
const domainResolver = async (req, res, next) => {
  const hostname = req.get('host');
  
  // Sanitize hostname - only allow valid domain characters
  const sanitizedHostname = hostname ? hostname.replace(/[^a-zA-Z0-9.-]/g, '').toLowerCase() : '';
  
  // Skip if invalid or empty hostname
  if (!sanitizedHostname) {
    return next();
  }
  
  // Remove port if present (e.g., localhost:5000 -> localhost)
  const hostWithoutPort = sanitizedHostname.split(':')[0];

  // Skip if it's your main domain or localhost
  if (
    hostWithoutPort === 'findvirtualme.com' ||
    hostWithoutPort === 'www.findvirtualme.com' ||
    hostWithoutPort === 'findvirtual.me' ||
    hostWithoutPort === 'www.findvirtual.me' ||
    hostWithoutPort === 'localhost' ||
    hostWithoutPort.includes('localhost')
  ) {
    return next();
  }

  try {
    // Look up the user and portfolio by custom domain
    const user = await User.findOne({
      'domains.domain': hostWithoutPort,
      'domains.status': 'active',
    });

    if (user) {
      const domainConfig = user.domains.find(
        (d) => d.domain === hostWithoutPort && d.status === 'active'
      );

      if (domainConfig?.portfolioId) {
        req.isCustomDomain = true;
        req.customDomain = hostWithoutPort;
        req.customDomainUser = user;
        req.customDomainPortfolioId = domainConfig.portfolioId;
        req.customDomainPortfolioType = user.industry || 'general';

       
        console.log(
          `Custom domain detected: ${hostWithoutPort} → User ID: ${user._id}`
        );
      }
    }
  } catch (error) {
    // Don't log full error details in production
    console.error('Domain lookup error:', error.message);
  }

  next();
};

module.exports = domainResolver;
