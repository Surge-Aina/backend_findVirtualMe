const xml2js = require('xml2js');
const parser = new xml2js.Parser();


const domainService = {
  // this checks if a domain is available and if it is premium
  getDomain: async (req, res) => {
    try {
      const domain = req.params.domain; // this is the domain to check
      if (!domain) {
        return res.status(400).json({ error: "Domain is required" });
      }
      // this a sandbox url for testing purposes change to production url when ready
      const params = new URLSearchParams({
        ApiUser: process.env.NAMECHEAP_USERNAME,
        ApiKey: process.env.NAMECHEAP_API_KEY,
        UserName: process.env.NAMECHEAP_USERNAME,
        Command: "namecheap.domains.check",
        ClientIp: process.env.NAMECHEAP_CLIENT_IP,
        DomainList: domain,
      });

      const url = `${process.env.NAMECHEAP_URL}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch domains. Status: ${response.status}`);
      }

      const xmlResponse = await response.text();
      parser.parseString(xmlResponse, (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ error: `Failed to parse XML: ${err.message}` });
        }

        try {
          const apiResponse = result.ApiResponse;

          // Check if the API returned an error
          if (apiResponse.$.Status === "ERROR") {
            const errorMsg = apiResponse.Errors[0].Error[0]._;
            const errorCode = apiResponse.Errors[0].Error[0].$.Number;
            return res.status(400).json({
              error: errorMsg,
              code: errorCode,
              details: "Namecheap API error",
            });
          }

          // Check if CommandResponse exists (successful response)
          if (
            !apiResponse.CommandResponse ||
            !apiResponse.CommandResponse[0] ||
            !apiResponse.CommandResponse[0].DomainCheckResult
          ) {
            return res
              .status(502)
              .json({ error: "Invalid API response structure" });
          }

          const domainCheckResult =
            apiResponse.CommandResponse[0].DomainCheckResult[0].$;
          const cleanResult = {
            domain: domainCheckResult.Domain,
            available: domainCheckResult.Available === "true",
            isPremium: domainCheckResult.IsPremiumName === "true",
            premiumPrice: parseFloat(
              domainCheckResult.PremiumRegistrationPrice || 0
            ),
            icannFee: parseFloat(domainCheckResult.IcannFee || 0),
          };

          res.status(200).json(cleanResult);
        } catch (parseError) {
          console.error("Error parsing API response:", parseError);
          res.status(500).json({ error: "Failed to process API response" });
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // this attaches a domain to the user
  attachDomainToUser: async (req, res) => {
    try {
      const domain = req.params.domain;
      if (!domain) {
        return res.status(400).json({ error: "Domain is required" });
      }

      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!user.domains) {
        user.domains = domain;
      }

      // Check for duplicates
      if (user.domains === domain) {
        return res
          .status(400)
          .json({ error: "Domain already attached to user" });
      }

      await user.save();
      res.status(200).json({ message: "Domain attached to user" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // this gets the domains by the user
  getDomainsByUser: async (req, res) => {
    try {
      const user = req.user;
      const domains = user.domains;
      res.status(200).json(domains);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
  domainPrice: async (req, res) => {
    try {
      const ProductType = "DOMAIN";
      const ProductCategory = "PURCHASE";
      const Duration = "1";
      const params = new URLSearchParams({
        ApiUser: process.env.NAMECHEAP_USERNAME,
        ApiKey: process.env.NAMECHEAP_API_KEY,
        UserName: process.env.NAMECHEAP_USERNAME,
        Command: "namecheap.domains.getPrice",
        ClientIp: process.env.NAMECHEAP_CLIENT_IP,
        ProductType: ProductType,
        ProductCategory: ProductCategory,
        Duration: Duration,
      });
      const url = `${process.env.NAMECHEAP_URL}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch domains. Status: ${response.status}`);
      }
      const xmlResponse = await response.text();
      parser.parseString(xmlResponse, (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ error: `Failed to parse XML: ${err.message}` });
        }
        const apiResponse = result.ApiResponse;
        const domainPrice = apiResponse.DomainPrice[0].$;
        res.status(200).json(domainPrice);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // Register domain through platform
  registerDomain: async (req, res) => {
    try {
      const { domain, portfolioId, plan } = req.body;
      const userId = req.user?.id;

      if (!domain || !portfolioId) {
        return res
          .status(400)
          .json({ error: "Domain and portfolioId are required" });
      }
      if (
        !process.env.USER_FIRST_NAME ||
        !process.env.USER_LAST_NAME ||
        !process.env.USER_ADDRESS1 ||
        !process.env.USER_CITY ||
        !process.env.USER_STATE ||
        !process.env.USER_ZIP ||
        !process.env.USER_COUNTRY ||
        !process.env.USER_PHONE ||
        !process.env.USER_EMAIL
      ) {
        return res.status(400).json({ error: "Registrant info is required" });
      }

      const params = new URLSearchParams({
        ApiUser: process.env.NAMECHEAP_USERNAME,
        ApiKey: process.env.NAMECHEAP_API_KEY,
        UserName: process.env.NAMECHEAP_USERNAME,
        Command: "namecheap.domains.create",
        ClientIp: process.env.NAMECHEAP_CLIENT_IP,

        DomainName: domain,
        Years: "1",

        RegistrantFirstName: process.env.USER_FIRST_NAME,
        RegistrantLastName: process.env.USER_LAST_NAME,
        RegistrantAddress1: process.env.USER_ADDRESS1,
        RegistrantCity: process.env.USER_CITY,
        RegistrantStateProvince: process.env.USER_STATE,
        RegistrantPostalCode: process.env.USER_ZIP,
        RegistrantCountry: process.env.USER_COUNTRY,
        RegistrantPhone: process.env.USER_PHONE,
        RegistrantEmailAddress: process.env.USER_EMAIL,
      });

      const fetchRes = await fetch(process.env.NAMECHEAP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const xmlResponse = await fetchRes.text();
      parser.parseString(xmlResponse, async (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ error: `Failed to parse XML: ${err.message}` });
        }
        const apiResponse = result.ApiResponse;

        if (apiResponse.$.Status === "OK") {
          // Update user's domains in database
          try {
            const User = require("../models/User");

            // Add domain to user's domains array
            await User.findByIdAndUpdate(
              userId,
              {
                $push: {
                  domains: {
                    domain: domain,
                    portfolioId: portfolioId,
                    type: "platform",
                    status: "active",
                    registeredAt: new Date(),
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
                    dnsConfigured: true, // Assume configured for platform domains
                    sslIssued: true, // Assume SSL issued for platform domains
                    subscriptionId: req.body.subscriptionId || null, // If Stripe subscription exists
                    autoRenew: true,
                  },
                },
              },
              { new: true }
            );

            console.log(
              `Domain ${domain} successfully linked to portfolio ${portfolioId} for user ${userId}`
            );
          } catch (dbErr) {
            console.error("Database update error:", dbErr);
          }
        }

        const domainRegistration =
          apiResponse?.CommandResponse?.[0]?.DomainCreateResult?.[0]?.$;

        return res.status(200).json({
          message: "Domain registration initiated",
          domain,
          portfolioId,
          plan,
          status: apiResponse.$.Status === "OK" ? "active" : "pending",
          apiResponse: domainRegistration,
        });
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // Configure custom domain (BYOD)
  configureCustomDomain: async (req, res) => {
    try {
      const { domain, portfolioId } = req.body;
      const userId = req.user?.id;

      if (!domain || !portfolioId) {
        return res
          .status(400)
          .json({ error: "Domain and portfolioId are required" });
      }

      // Add BYOD domain to user's domains array
      const User = require("../models/User");
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            domains: {
              domain: domain,
              portfolioId: portfolioId,
              type: "byod", // Bring Your Own Domain
              status: "pending", // Needs DNS verification
              registeredAt: new Date(),
              dnsConfigured: false, // User needs to configure DNS
              sslIssued: false, // SSL pending DNS verification
            },
          },
        },
        { new: true }
      );

      res.status(200).json({
        message: "Custom domain configured - please verify DNS settings",
        domain,
        portfolioId,
        status: "pending_verification",
        instructions: {
          dns: `Add CNAME record: ${domain} -> ${
            process.env.MAIN_DOMAIN || "findvirtualme.com"
          }`,
          verification: `Visit ${domain} once DNS propagates`,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // Get user's domains
  getUserDomains: async (req, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id || req.user?._id;

      // Authorization check: user can only access their own domains
      // unless they have admin role
      if (authenticatedUserId.toString() !== userId) {
        // Check if user has admin role (if role system exists)
        const userRole = req.user?.role;
        if (userRole !== "admin" && userRole !== "superadmin") {
          return res.status(403).json({
            error: "Forbidden: You can only access your own domains",
            code: "INSUFFICIENT_PERMISSIONS",
          });
        }
      }

      const User = require("../models/User");
      const user = await User.findById(userId).select("domains portfolios");

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        domains: user.domains || [],
        portfolios: user.portfolios || [],
        message: "User domains retrieved successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },

  // Get current authenticated user's domains
  getMyDomains: async (req, res) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json({
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
        },
        domains: user.domains || [],
        portfolios: user.portfolios || [],
        message: "User domains retrieved successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};

module.exports = domainService;