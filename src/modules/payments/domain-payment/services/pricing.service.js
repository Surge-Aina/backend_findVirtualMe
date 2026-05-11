const namecheap = require("./namecheapProxy.service");

// --- Pricing constants ---
const TLD_PREMIUM = 2.0;
const FLAT_PRICE = 12.99;

// --- Pricing cache ---
let pricingCache = null;
let pricingCacheTime = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

async function getTldPricing(tld) {
  if (
    !pricingCache ||
    !pricingCacheTime ||
    Date.now() - pricingCacheTime > CACHE_DURATION
  ) {
    const apiResult = await namecheap.getPricing();

    let categories =
      apiResult?.CommandResponse?.UserGetPricingResult?.ProductType?.ProductCategory;

    if (!categories) {
      throw new Error("ProductCategory missing from Namecheap pricing response");
    }

    // ✅ Normalize to array
    if (!Array.isArray(categories)) {
      categories = [categories];
    }

    const registerCategory = categories.find(
      (c) => c.$?.Name?.toUpperCase() === "REGISTER"
    );

    if (!registerCategory) {
      throw new Error("REGISTER pricing not found");
    }

    let products = registerCategory.Product;
    if (!products) {
      throw new Error("No products found in REGISTER category");
    }

    // ✅ Normalize products
    if (!Array.isArray(products)) {
      products = [products];
    }

    pricingCache = {};

    for (const product of products) {
      const tldName = product.$?.Name?.toLowerCase();
      if (!tldName) continue;

      let prices = product.Price;
      if (!prices) continue;

      // ✅ Normalize prices
      if (!Array.isArray(prices)) {
        prices = [prices];
      }

      const oneYear = prices.find((p) => p.$?.Duration === "1");
      if (!oneYear) continue;

      pricingCache[tldName] = {
        price: parseFloat(oneYear.$.Price || 0),
        icannFee: parseFloat(oneYear.$.AdditionalCost || 0),
      };
    }

    pricingCacheTime = Date.now();
  }

  const pricing = pricingCache[tld.toLowerCase()];
  if (!pricing) {
    throw new Error(`Pricing not found for TLD: .${tld}`);
  }

  return pricing;
}

exports.checkDomainAndGetPrice = async (domain) => {
  const [_, tld] = domain.split(".");
  if (!tld) throw new Error("Invalid domain");

  const checkResult = await namecheap.checkDomain(domain);
  const domainData = checkResult.CommandResponse.DomainCheckResult.$;

  if (domainData.Available !== "true") {
    return { domain, available: false };
  }

  const isPremium = domainData.IsPremiumName === "true";

  if (isPremium) {
    const price = parseFloat(domainData.PremiumRegistrationPrice);
    const icannFee = parseFloat(domainData.IcannFee || 0);

    return {
      domain,
      available: true,
      isPremium: true,
      basePrice: price.toFixed(2),
      icannFee: icannFee.toFixed(2),
      totalPrice: (price + icannFee).toFixed(2),
    };
  }

  const { price, icannFee } = await getTldPricing(tld);

  let platformFee = 0;
  let totalPrice = 0;

  if (price <= FLAT_PRICE) {
    platformFee = FLAT_PRICE - price;
    totalPrice = FLAT_PRICE + icannFee;
  } else {
    platformFee = TLD_PREMIUM;
    totalPrice = price + icannFee + platformFee;
  }

  return {
    domain,
    available: true,
    isPremium: false,
    basePrice: price.toFixed(2),
    icannFee: icannFee.toFixed(2),
    platformFee: platformFee.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
  };
};
