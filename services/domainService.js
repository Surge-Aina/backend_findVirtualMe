const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const Portfolio = require('../models/Portfolio');

const domainService = {
    // this checks if a domain is available and if it is premium
    getDomain: async (req, res) => {

      try {
        const domain = req.params.domain; // this is the domain to check
        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
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
          throw new Error(
            `Failed to fetch domains. Status: ${response.status}`
          );
        }
        const xmlResponse = await response.text();
        parser.parseString(xmlResponse, (err, result) => {
          if (err) {
            throw new Error(`Failed to parse XML. Status: ${err}`);
          }
          const jsonString = JSON.stringify(result, null, 2);
          console.log(jsonString);
          const domainCheckResult =
            JSON.parse(jsonString).ApiResponse.CommandResponse[0]
              .DomainCheckResult[0].$;
          const cleanResult = {
            domain: domainCheckResult.Domain,
            available: domainCheckResult.Available === "true",
            isPremium: domainCheckResult.IsPremiumName === "true",
            premiumPrice: parseFloat(
              domainCheckResult.PremiumRegistrationPrice
            ),
            icannFee: parseFloat(domainCheckResult.IcannFee),
          };

          res.status(200).send(cleanResult);
        });



      } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
      }
    },

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

        // Initialize domains array if it doesn't exist
        if (!Array.isArray(user.domains)) {
          user.domains = [];
        }

        // Check for duplicates
        if (user.domains.includes(domain)) {
          return res
            .status(400)
            .json({ error: "Domain already attached to user" });
        }
        
        user.domains.push(domain);
        await user.save();
        res.status(200).json({ message: 'Domain attached to user' });
      }
     catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  },
  
  
  };
  
  

  module.exports = domainService;