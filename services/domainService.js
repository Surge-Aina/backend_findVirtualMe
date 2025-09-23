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

      console.log(
        "Final URL:",
        `${process.env.NAMECHEAP_URL}?${params.toString()}`
      );
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
};

module.exports = domainService;