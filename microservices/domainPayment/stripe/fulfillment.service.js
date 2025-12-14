const { URLSearchParams } = require("url");
// const { fetch } = require("node-fetch"); // Assuming node-fetch or similar is used
const xml2js = require("xml2js");
const parser = new xml2js.Parser({ explicitArray: false });

const User = require("../../../models/User"); // Adjust path as needed
const vercelService = require("../../../services/vercelService"); // Your existing Vercel service
const { default: axios } = require("axios");

// Hardcoded Registrant Info from Environment Variables
const REGISTRANT_INFO = {
  FirstName: process.env.USER_FIRST_NAME,
  LastName: process.env.USER_LAST_NAME,
  Address1: process.env.USER_ADDRESS1,
  City: process.env.USER_CITY,
  StateProvince: process.env.USER_STATE,
  PostalCode: process.env.USER_ZIP,
  Country: process.env.USER_COUNTRY,
  Phone: process.env.USER_PHONE,
  EmailAddress: process.env.USER_EMAIL,
};
const NAMESERVERS = process.env.USER_NAMESERVERS; // Comma-separated list if needed

/**
 * 1. Calls the Namecheap domains.create command using the platform's credentials.
 * @param {string} domainName
 * @returns {Promise<object>} The parsed Namecheap XML result.
 */

const MOCK_MODE = process.env.MOCK_NAMECHEAP === "true";
async function registerDomainOnNamecheap(domainName) {
  if (MOCK_MODE) {
    console.log("🧪 MOCK MODE: Simulating domain registration for", domainName);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Return mock success
    return {
      ApiResponse: {
        $: { Status: "OK" },
        CommandResponse: [
          {
            DomainCreateResult: [
              {
                $: {
                  Domain: domainName,
                  Registered: "true",
                  ChargedAmount: "0.00",
                },
              },
            ],
          },
        ],
      },
    };
  }
  console.log("====LIVE MODE=====: Using live domain registration for", domainName);
  const allParams = new URLSearchParams({
    ApiUser: process.env.NAMECHEAP_USERNAME,
    ApiKey: process.env.NAMECHEAP_API_KEY,
    UserName: process.env.NAMECHEAP_USERNAME,
    Command: "namecheap.domains.create",
    ClientIp: process.env.NAMECHEAP_CLIENT_IP,

    DomainName: domainName,
    Years: "1",
    AddFreeWhoisGuard: "yes", // Optional, usually included

    // Populate all four contact types with platform info
    ...Object.entries(REGISTRANT_INFO).reduce((acc, [key, value]) => {
      acc[`Registrant${key}`] = value;
      acc[`Admin${key}`] = value;
      acc[`Tech${key}`] = value;
      acc[`AuxBilling${key}`] = value;
      return acc;
    }, {}),

    Nameservers: NAMESERVERS, // If you configure them directly during purchase
  });

  const url = `${process.env.NAMECHEAP_URL}?${allParams.toString()}`;
  const response = await axios.get(url);

  const xmlResponse = await response.data;

  let result;
  await new Promise((resolve, reject) => {
    parser.parseString(xmlResponse, (err, res) => {
      if (err) return reject(new Error(`XML parsing error: ${err.message}`));
      result = res;
      resolve();
    });
  });

  // Check for Namecheap API Error status
  const apiStatus = result?.ApiResponse?.$?.Status;
  if (apiStatus === "ERROR") {
    const errorMsg = result.ApiResponse.Errors.Error._ || "Namecheap registration failed";
    throw new Error(errorMsg);
  }

  return result;
}

/**
 * 2. Configures DNS records after successful purchase.
 * We are using Vercel DNS setup here, not Namecheap's DNS command,
 * because Vercel handles the verification and SSL provisioning.
 * * NOTE: The old domainService.registerDomain already had Vercel logic.
 * We are moving and adapting it here to run AFTER the payment.
 * * @param {string} domainName
 */
async function configureDnsAndVercel(domainName, userId, portfolioId) {
  // Add domain to Vercel project (This is where Vercel will give you the verification details)
  let vercelResult;
  try {
    vercelResult = await vercelService.addDomain(domainName, userId, portfolioId);

    // Vercel only requires a CNAME on the root (@) or a redirect,
    // but since we registered it, we need to set the Namecheap DNS
    // to point to Vercel's nameservers, or simply wait for the
    // domain to resolve to Vercel's nameservers if they were set at creation.

    // This is a placeholder for any final DNS update if the initial nameservers
    // set during registration (in step 1) were not enough.
    console.log(`Vercel domain added. Verification status: ${vercelResult.verified}`);
  } catch (vercelErr) {
    console.error("Vercel domain setup failed:", vercelErr.message);
    // Do not throw; we still want to save the domain as 'pending_verification'
    return { verified: false, error: vercelErr.message };
  }

  return { verified: vercelResult?.verified === true };
}

/**
 * Main fulfillment logic: runs ONLY on successful Stripe payment.
 */
async function handleFulfillment(domain, userId, portfolioId, paymentIntentId) {
  let registrationSuccess = false;

  try {
    // STEP 1: Register the domain on Namecheap
    await registerDomainOnNamecheap(domain);
    registrationSuccess = true;

    // STEP 2: Configure DNS/Vercel
    const dnsConfig = await configureDnsAndVercel(domain, userId, portfolioId);
    const isVerified = dnsConfig.verified;

    const domainEntry = {
      domain,
      portfolioId,
      type: "platform",
      status: isVerified ? "active" : "pending_verification",
      dnsConfigured: isVerified,
      registeredAt: new Date(),
      // Namecheap API response should be parsed for the actual expiration date!
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      paymentIntentId: paymentIntentId,
    };

    // STEP 3: Update MongoDB (Success)
    await User.updateOne({ _id: userId }, { $push: { domains: domainEntry } });
    console.log(`SUCCESS: Domain ${domain} registered and linked to user ${userId}.`);
  } catch (error) {
    // STEP 4: Handle Failure (Namecheap failed after payment)
    console.error(
      `CRITICAL FAILURE: Domain ${domain} failed registration after payment:`,
      error.message
    );

    // We push a 'failed' record for manual review and refund.
    const failureEntry = {
      domain,
      portfolioId,
      status: "failed_registration", // New status
      failureReason: error.message,
      paymentIntentId: paymentIntentId,
      registeredAt: new Date(),
    };

    await User.updateOne({ _id: userId }, { $push: { domains: failureEntry } });
    // NOTE: Refund logic (via Stripe API or manual) should be triggered here/alerted.
  }
}

// --- Custom Pricing Constants (Move to ENV variables later if needed) ---
const TLD_PREMIUM = 5.0; // Your custom fee for TLDs priced above the minimum
const FLAT_PRICE = 12.99; // Your flat rate for cheap TLDs

/* Executes a Namecheap API call and handles XML parsing and API status checks.
 * @param {string} command - The Namecheap API command (e.g., "namecheap.domains.check")
 * @param {object} customParams - Command-specific parameters
 * @returns {Promise<object>} The parsed ApiResponse object.
 */
async function callNamecheapApi(command, customParams = {}) {
  const allParams = new URLSearchParams({
    ApiUser: process.env.NAMECHEAP_USERNAME,
    ApiKey: process.env.NAMECHEAP_API_KEY,
    UserName: process.env.NAMECHEAP_USERNAME,
    Command: command,
    ClientIp: process.env.NAMECHEAP_CLIENT_IP,
    ...customParams,
  });

  const url = `${process.env.NAMECHEAP_URL}?${allParams.toString()}`;
  //   console.log(`[NC] Calling: ${command} with URL: ${url}`);
  // Using axios as per your updated code
  const response = await axios.get(url);
  const xmlResponse = await response.data;

  let apiResult;
  await new Promise((resolve, reject) => {
    parser.parseString(xmlResponse, (err, result) => {
      if (err)
        return reject(new Error(`Failed to parse XML from ${command}: ${err.message}`));

      apiResult = result.ApiResponse;

      // CRITICAL: Check API Status for ERROR
      if (apiResult.$.Status === "ERROR") {
        // --- ROBUST ERROR EXTRACTION FIX ---
        let errorMsg = "Unknown Namecheap API Error";

        if (apiResult.Errors && apiResult.Errors.Error) {
          // Check if the Error object is an array (multiple errors) or a single object
          const errorObject = Array.isArray(apiResult.Errors.Error)
            ? apiResult.Errors.Error[0]
            : apiResult.Errors.Error;

          // Prioritize text content, then attributes, then fallback
          if (errorObject._) {
            errorMsg = errorObject._; // The standard location
          } else if (errorObject.Message) {
            errorMsg = errorObject.Message; // Some commands use 'Message'
          } else if (errorObject.$.Code) {
            errorMsg = `Error Code: ${errorObject.$.Code}`; // Fallback to code
          } else {
            errorMsg = "Unparsable Namecheap Error";
          }
        }
        // --- END FIX ---

        console.error(`Namecheap ${command} API Error:`, errorMsg);
        return reject(new Error(`Namecheap API Error for ${command}: ${errorMsg}`));
      }

      resolve();
    });
  });

  return apiResult;
}

// Cache pricing data (add this at the top of your file, outside any function)
let pricingCache = null;
let pricingCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Gets pricing for a specific TLD from cache or API
 */
async function getTldPricing(tld) {
  // Check if cache is valid
  if (
    !pricingCache ||
    !pricingCacheTime ||
    Date.now() - pricingCacheTime > CACHE_DURATION
  ) {
    console.log("Fetching fresh pricing data from Namecheap...");

    const priceApiResult = await callNamecheapApi("namecheap.users.getPricing", {
      ProductType: "DOMAIN",
      ActionName: "REGISTER",
    });

    // Parse and store in cache
    const productType = priceApiResult.CommandResponse?.UserGetPricingResult?.ProductType;
    let categories = productType?.ProductCategory;

    if (!categories) {
      throw new Error("Could not find ProductCategory in pricing response");
    }

    if (!Array.isArray(categories)) {
      categories = [categories];
    }

    const registerCategory = categories.find(
      (c) => c.$?.Name === "REGISTER" || c.$.Name?.toUpperCase() === "REGISTER"
    );

    if (!registerCategory) {
      throw new Error("Could not find REGISTER category");
    }

    let products = registerCategory?.Product;

    if (!products) {
      throw new Error("No products found in REGISTER category");
    }

    if (!Array.isArray(products)) {
      products = [products];
    }

    // Create a simple map of TLD -> Price for fast lookup
    pricingCache = {};
    products.forEach((product) => {
      const tldName = (product.$?.Name || "").toLowerCase();
      const prices = Array.isArray(product.Price) ? product.Price : [product.Price];
      const oneYearPrice = prices.find((p) => p.$.Duration === "1");

      if (oneYearPrice) {
        pricingCache[tldName] = {
          price: parseFloat(oneYearPrice.$.Price || 0),
          icannFee: parseFloat(oneYearPrice.$.AdditionalCost || 0),
        };
      }
    });

    pricingCacheTime = Date.now();
    console.log(`Cached pricing for ${Object.keys(pricingCache).length} TLDs`);
  }

  // Return pricing for requested TLD
  const pricing = pricingCache[tld.toLowerCase()];
  if (!pricing) {
    throw new Error(`Pricing not found for TLD: .${tld}`);
  }

  return pricing;
}

/**
 * Checks domain availability and calculates the final selling price using Namecheap.
 * @param {string} domain - The full domain name (e.g., example.com)
 * @returns {Promise<object>} Object with { domain, available, totalPrice, isPremium, ... }
 */
async function checkDomainAndGetPrice(domain) {
  try {
    const domainParts = domain.split(".");
    if (domainParts.length < 2) {
      throw new Error("Invalid domain format (missing TLD).");
    }
    const tld = domainParts[domainParts.length - 1];

    // --- 1. NAMECHEAP: Check Domain Availability ---
    const checkApiResult = await callNamecheapApi("namecheap.domains.check", {
      DomainList: domain,
    });

    const domainCheckResults = checkApiResult.CommandResponse.DomainCheckResult;
    if (!domainCheckResults) {
      throw new Error("Invalid Namecheap Check response: Missing DomainCheckResult.");
    }

    const domainData = Array.isArray(domainCheckResults)
      ? domainCheckResults[0].$
      : domainCheckResults.$;

    const isAvailable = domainData.Available === "true";
    const isPremium = domainData.IsPremiumName === "true";

    if (!isAvailable) {
      return { domain, available: false, isPremium: isPremium };
    }

    // --- 2. Get Pricing ---
    let finalPriceDetails = {};

    if (isPremium) {
      // PREMIUM DOMAIN - pricing is in the check response
      const premiumPrice = parseFloat(domainData.PremiumRegistrationPrice || 0);
      const icannFee = parseFloat(domainData.IcannFee || 0);

      finalPriceDetails = {
        basePrice: premiumPrice.toFixed(2),
        icannFee: icannFee.toFixed(2),
        totalPrice: (premiumPrice + icannFee).toFixed(2),
        priceSource: "Premium Domain",
        platformFee: (0).toFixed(2),
      };
    } else {
      // STANDARD DOMAIN - get pricing from cache/API
      const tldPricing = await getTldPricing(tld);
      const ncRegistrationPrice = tldPricing.price;
      const icannFee = tldPricing.icannFee;

      console.log(
        `TLD: ${tld}, NC Price: $${ncRegistrationPrice}, ICANN Fee: $${icannFee}`
      );

      // Apply custom pricing logic
      let platformFee = 0;
      let totalPrice = 0;
      let priceSource = "";

      if (ncRegistrationPrice <= FLAT_PRICE) {
        platformFee = FLAT_PRICE - ncRegistrationPrice;
        totalPrice = FLAT_PRICE + icannFee;
        priceSource = "Platform Flat Rate";
      } else {
        platformFee = TLD_PREMIUM;
        totalPrice = ncRegistrationPrice + icannFee + platformFee;
        priceSource = "Namecheap + Premium";
      }

      finalPriceDetails = {
        basePrice: ncRegistrationPrice.toFixed(2),
        icannFee: icannFee.toFixed(2),
        platformFee: platformFee.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        priceSource: priceSource,
      };
    }

    return {
      domain: domain,
      available: true,
      isPremium: isPremium,
      ...finalPriceDetails,
    };
  } catch (err) {
    console.error("Critical Error in checkDomainAndGetPrice:", err.message);
    throw err;
  }
}
module.exports = {
  handleFulfillment,
  checkDomainAndGetPrice,
};
