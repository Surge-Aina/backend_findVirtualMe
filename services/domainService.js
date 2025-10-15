const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const User = require("../models/User");
const vercelService = require("./vercelService");


const determinePortfolioPath = ({ user, domainConfig }) => {
  if (!user || !domainConfig) {
    return null;
  }

  const portfolioId = domainConfig.portfolioId;
  if (!portfolioId) {
    return null;
  }

  const rawIndustry =
    domainConfig.industry || user.industry || domainConfig.portfolioType || "";
  const industry =
    typeof rawIndustry === "string" ? rawIndustry.toLowerCase() : "";
  const username = user.username || user.email?.split("@")[0];

  switch (industry) {
    case "handyman":
      return `/portfolios/handyman/${portfolioId}`;
    case "photographer":
      return `/portfolios/photographer/${portfolioId}`;
    case "local_vendor":
    case "local-vendor":
    case "vendor":
      if (username) {
        return `/portfolios/vendor/${username}/${portfolioId}`;
      }
      return `/portfolios/localVendor`;
    case "project_manager":
    case "project-manager":
    case "project manager":
      if (username) {
        return `/portfolios/project-manager/${username}/${portfolioId}`;
      }
      if (username && portfolioId) {
        return `/portfolios/project-manager/${username}/${portfolioId}`;
      }
    default:
      return null;
  }
};

const parseVercelErrorResponse = (error) => {
  if (!error) {
    return {};
  }

  const rawBody =
    error.body ||
    error.parsedBody ||
    error.originalError?.body ||
    error.originalError?.parsedBody ||
    null;

  let parsedBody = null;
  if (rawBody) {
    if (typeof rawBody === "string") {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = null;
      }
    } else if (typeof rawBody === "object") {
      parsedBody = rawBody;
    }
  }

  const apiError = parsedBody?.error;
  const message =
    apiError?.message ||
    error.humanMessage ||
    error.message ||
    "Vercel request failed";

  return {
    message,
    code: error.code || apiError?.code,
    body: parsedBody,
    verification: error.verification || parsedBody?.verification,
  };
};

const addDomainToUser = async (userId, domain, portfolioId, options = {}) => {
  if (!userId) {
    throw new Error("User ID is required to associate domain");
  }
  if (!domain) {
    throw new Error("Domain is required to associate domain");
  }

  let changedPortfolioId =
    Array.isArray(portfolioId) && portfolioId.length > 0
      ? portfolioId[0]
      : portfolioId || null;

  const domainEntry = {
    domain,
    portfolioId: changedPortfolioId,
    type: options.type || "platform",
    status: options.status || (options.dnsConfigured ? "active" : "pending"),
    dnsConfigured: options.dnsConfigured ?? false,
    registeredAt: options.registeredAt || new Date(),
    expiresAt: options.expiresAt,
    autoRenew: options.autoRenew ?? true,
  };

  Object.keys(domainEntry).forEach((key) => {
    if (domainEntry[key] === undefined) {
      delete domainEntry[key];
    }
  });

  await User.updateOne({ _id: userId }, { $pull: { domains: { domain } } });

  const updateOps = {
    $push: { domains: domainEntry },
  };

  if (portfolioId) {
    updateOps.$addToSet = { portfolios: portfolioId };
  }

  return User.findByIdAndUpdate(userId, updateOps, { new: true });
};

const domainService = {
  // this checks if a domain is available and if it is premium
  getDomain: async (req, res) => {
    //
    try {
      const domain = req.params.domain; // this is the domain to check
      if (!domain) {
        return res.status(400).json({ error: "Domain is required" });
      }
      // this a sandbox url for testing purposes change to production url when ready
      // example : https://api.sandbox.namecheap.com/xml.response?ApiUser=jacksangl&ApiKey=...&Command=namecheap.domains.check&DomainList=example.com
      const params = new URLSearchParams({
        ApiUser: process.env.NAMECHEAP_USERNAME,
        ApiKey: process.env.NAMECHEAP_API_KEY,
        UserName: process.env.NAMECHEAP_USERNAME,
        Command: "namecheap.domains.check",
        ClientIp: process.env.NAMECHEAP_CLIENT_IP,
        DomainList: domain,
      });

      // sets the url for the namecheap api
      const url = `${process.env.NAMECHEAP_URL}?${params.toString()}`;
      const controller = new AbortController();
      let response;
      // if the response takes 10 seconds, abort the request
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout+
      try {
        response = await fetch(url);
      } finally {
        clearTimeout(timeoutId);
      }

      // checks if the response is ok
      if (!response.ok) {
        throw new Error(`Failed to fetch domains. Status: ${response.status}`);
      }

      // parses the response to xml
      const xmlResponse = await response.text();
      // parses the xml response to a javascript object
      parser.parseString(xmlResponse, (err, result) => {
        if (err) {
          return res
            .status(500)
            .json({ error: `Failed to parse XML: ${err.message}` });
        }

        // checks if the api response is ok
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

          // gets the domain check result
          const domainCheckResult =
            apiResponse.CommandResponse[0].DomainCheckResult[0].$;
          // cleans the result
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

  // Register domain through platform
  registerDomain: async (req, res) => {
    //
    try {
      let { domain, portfolioId, plan } = req.body;
      const userId = req.user?.id;

      // Ensure domain is a string
      // if the domain is an array, join the array into a string
      // if the domain is not a string, convert it to a string
      // if the domain is not a string, convert it to a string
      domain = Array.isArray(domain) ? domain.join("") : String(domain || "");
      domain = domain.trim().toLowerCase();
      portfolioId = Array.isArray(portfolioId) ? portfolioId[0] : portfolioId;

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
        !process.env.USER_EMAIL ||
        !process.env.USER_NAMESERVERS
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
        Nameservers: process.env.USER_NAMESERVERS,
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
            // Add domain to Vercel project
            let vercelResult;
            try {
              vercelResult = await vercelService.addDomain(
                domain,
                userId,
                portfolioId
              );
              console.log(`Domain ${domain} added to Vercel project`);
            } catch (vercelErr) {
              console.error("Vercel add domain error:", vercelErr.message);
              // Continue even if Vercel fails
            }

            // Add domain to user's domains array
            await addDomainToUser(userId, domain, portfolioId, {
              type: "platform",
              dnsConfigured: vercelResult?.verified ?? true,
              status: vercelResult?.verified
                ? "active"
                : "pending_verification",
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
              autoRenew: true,
            });

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
          domain: domain,
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
      let { domain, portfolioId } = req.body;
      const userId = req.user?.id;

      // Ensure domain is a string
      // example before : ["example.com"]
      // example after : "example.com"
      const domainString = Array.isArray(domain)
        ? domain.join("")
        : String(domain || "");
      domain = domainString.trim().toLowerCase();
      // if the portfolioId is an array, get the first element
      // probably not needed since we are using the portfolioId from the request body
      if (Array.isArray(portfolioId)) {
        portfolioId = portfolioId[0];
      }

      if (!domain || !portfolioId) {
        return res
          .status(400)
          .json({ error: "Domain and portfolioId are required" });
      }

      // Add domain to Vercel project
      let vercelResult;
      try {
        // add the domain to the vercel project
        vercelResult = await vercelService.addDomain(
          domain,
          userId,
          portfolioId
        );
        console.log(`Custom domain ${domain} added to Vercel project`);
      } catch (vercelErr) {
        // if the domain is not added to the vercel project, return an error
        const vercelError = parseVercelErrorResponse(vercelErr);
        console.error("Vercel add domain error:", vercelErr.message);
        // if the domain is not added to the vercel project, return an error
        const statusCode = vercelErr.statusCode || 500;
        const detailMessage =
          typeof vercelError.message === "string"
            ? vercelError.message
            : "Failed to add domain to Vercel";

        return res.status(statusCode).json({
          error: "Failed to add domain to Vercel",
          message: detailMessage,
          code: vercelError.code,
          verification: vercelError.verification || null,
          details: detailMessage,
          meta:
            vercelError.body && typeof vercelError.body === "object"
              ? vercelError.body
              : undefined,
        });
      }

      // add the domain to the user's domains array
      // could change to bring in the type.
      await addDomainToUser(userId, domain, portfolioId, {
        type: "byod",
        dnsConfigured: Boolean(vercelResult?.verified),
        status: vercelResult?.verified ? "active" : "pending_verification",
      });

      res.status(200).json({
        message: "Custom domain configured - please verify DNS settings",
        domain: domain,
        portfolioId: portfolioId,
        status: vercelResult?.verified ? "active" : "pending_verification",
        verification: vercelResult?.verification, // DNS records to configure
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

  // Lookup portfolio by custom domain (PUBLIC endpoint)
  lookupPortfolioByDomain: async (req, res) => {
    try {
      let domain = req.params.domain;

      domain = domain.replace(/[^a-zA-Z0-9.-]/g, "");

      if (!domain) {
        return res.status(400).json({
          error: "Invalid domain format",
          message: "Domain contains invalid characters",
        });
      }

      console.log(`Looking up portfolio for domain: ${domain}`);

      // Find user with this domain
      const user = await User.findOne({
        "domains.domain": domain,
        "domains.status": "active",
      });

      if (!user) {
        return res.status(404).json({
          error: "Domain not found",
          message: "No portfolio found for this domain",
        });
      }

      // Get the domain configuration
      const domainConfig = user.domains.find((d) => d.domain === domain);

      const portfolioPath = determinePortfolioPath({
        user,
        domainConfig:
          typeof domainConfig?.toObject === "function"
            ? domainConfig.toObject()
            : domainConfig,
      });

      console.log(`Found domain for user ID: ${user._id}`);

      res.json({
        success: true,
        domain: domain,
        portfolioId: domainConfig.portfolioId,
        portfolioPath,
        user: {
          // Only return what's needed for portfolio display
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          industry: user.industry,
        },
      });
    } catch (error) {
      console.error("Error looking up domain:", error.message);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  },

  verifyDNS: async (req, res) => {
    try {
      const user = req.user;
      const domainName = req.params.domain;

      if (!user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Find the user and specific domain record
      const userRecord = await User.findOne({
        _id: user._id,
        "domains.domain": domainName,
      });

      if (!userRecord) {
        return res.status(404).json({ error: "Domain not found" });
      }

      const domainRecord = userRecord.domains.find(
        (d) => d.domain === domainName
      );

      if (!domainRecord) {
        return res.status(404).json({ error: "Domain not found" });
      }

      // Already active
      if (domainRecord.status === "active") {
        return res.status(200).json({ message: "Domain is already active" });
      }

      // Verify domain with Vercel
      const dnsVerified = await vercelService.verifyDomain(domainName);

      if (dnsVerified.verified) {
        // Update domain status inside the embedded domains array
        await User.updateOne(
          { _id: user._id, "domains.domain": domainName },
          {
            $set: {
              "domains.$.status": "active",
              "domains.$.dnsConfigured": true,
            },
          }
        );

        return res.status(200).json({
          message: "Domain verified and activated",
          domain: domainName,
        });
      } else {
        return res.status(400).json({
          message: "DNS verification failed",
          details: dnsVerified.verification || null,
        });
      }
    } catch (error) {
      console.error("DNS Failed:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};

module.exports = domainService;
