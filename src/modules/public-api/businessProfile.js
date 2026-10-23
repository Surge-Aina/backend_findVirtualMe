/**
 * Published business profile.
 * Only fields the site itself shows are eligible. Account email, phone,
 * personal name, and private location are never read from the user record.
 */

const COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "accentStrong",
  "background",
  "page",
  "text",
];

function visibleSections(portfolio, type) {
  return (portfolio?.sections || []).filter(
    (section) => section && section.type === type && section.visible !== false
  );
}

function looksLikePrivateContact(value) {
  if (value.includes("@")) return true;
  if (/^\d{5}(?:-\d{4})?$/.test(value)) return false;

  const compact = value.replace(/\s+/g, "");
  if (/^\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}$/.test(compact)) return true;
  if (/^\d{3}[-.\s]\d{4}$/.test(value)) return true;

  const letters = value.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0) return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) return true;
  if (digits.length >= 7 && digits.length < 10) {
    return value.includes("+") || value.includes("(") || (value.match(/[-.]/g) || []).length >= 2;
  }
  return false;
}

function cleanText(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (looksLikePrivateContact(trimmed)) return null;
  return trimmed.slice(0, max);
}

function firstText(values, max) {
  for (const value of values) {
    const cleaned = cleanText(value, max);
    if (cleaned) return cleaned;
  }
  return null;
}

function isColor(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32) return false;
  return (
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed) ||
    /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)
  );
}

function isPublicHttpUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  let url;
  try {
    url = new URL(trimmed);
  } catch (_err) {
    return false;
  }
  if (url.username || url.password) return false;
  return url.protocol === "https:" || url.protocol === "http:";
}

function businessName(portfolio) {
  const heroNames = visibleSections(portfolio, "hero").flatMap((section) => {
    const data = section.data || {};
    return [data.practiceName, data.businessName, data.companyName];
  });
  const summaryNames = visibleSections(portfolio, "summary").map(
    (section) => section.data?.name
  );
  return firstText([...heroNames, portfolio.title, ...summaryNames], 200);
}

function logoUrl(portfolio) {
  const heroLogos = visibleSections(portfolio, "hero").flatMap((section) => {
    const data = section.data || {};
    return [data.logoImage, data.logoUrl, data.logo];
  });
  const summaryLogos = visibleSections(portfolio, "summary").flatMap((section) => {
    const data = section.data || {};
    return [data.logoUrl, data.profileImage];
  });
  for (const candidate of [...heroLogos, ...summaryLogos]) {
    if (isPublicHttpUrl(candidate)) return candidate.trim();
  }
  return null;
}

function brandColors(portfolio) {
  const colors = {};
  const tokens =
    portfolio.themeTokens && typeof portfolio.themeTokens === "object"
      ? portfolio.themeTokens
      : {};
  for (const key of COLOR_KEYS) {
    if (isColor(tokens[key])) colors[key] = tokens[key].trim();
  }

  const banner =
    portfolio.pageBannerDefaults && typeof portfolio.pageBannerDefaults === "object"
      ? portfolio.pageBannerDefaults
      : {};
  if (isColor(banner.gradientFrom)) colors.gradientFrom = banner.gradientFrom.trim();
  if (isColor(banner.gradientTo)) colors.gradientTo = banner.gradientTo.trim();
  return colors;
}

function addressFromObject(addr) {
  if (!addr || typeof addr !== "object" || Array.isArray(addr)) return null;
  const line1 = cleanText(addr.street || addr.line1, 200);
  const city = cleanText(addr.city, 120);
  const region = cleanText(addr.state || addr.region, 120);
  const postalCode = cleanText(addr.zip || addr.postalCode, 32);
  const country = cleanText(addr.country, 120);
  if (!line1 && !city && !region && !postalCode && !country) return null;
  return {
    line1,
    city,
    region,
    postalCode,
    country,
    formatted: [line1, city, region, postalCode, country].filter(Boolean).join(", "),
  };
}

function formattedLocation(value) {
  const formatted = cleanText(value, 200);
  if (!formatted) return null;
  return {
    line1: null,
    city: null,
    region: null,
    postalCode: null,
    country: null,
    formatted,
  };
}

function address(portfolio) {
  for (const section of visibleSections(portfolio, "contact")) {
    const structured = addressFromObject(section.data?.address);
    if (structured) return structured;
  }
  for (const section of visibleSections(portfolio, "contact")) {
    const location = formattedLocation(section.data?.location);
    if (location) return location;
  }
  for (const section of visibleSections(portfolio, "summary")) {
    const location = formattedLocation(section.data?.location);
    if (location) return location;
  }
  return null;
}

function publishedEmail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

function publishedPhone(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40 || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  return trimmed;
}

function publishedContact(portfolio) {
  const section = visibleSections(portfolio, "contact")[0];
  const data = section && section.data ? section.data : {};
  const email = publishedEmail(data.email);
  const phone = publishedPhone(data.phone);
  const website = isPublicHttpUrl(data.website) ? data.website.trim() : null;
  if (!email && !phone && !website) return null;
  return { email, phone, website };
}

function buildBusinessProfile(portfolio) {
  return {
    siteId: portfolio._id.toString(),
    businessName: businessName(portfolio),
    logoUrl: logoUrl(portfolio),
    brandColors: brandColors(portfolio),
    address: address(portfolio),
  };
}

module.exports = {
  buildBusinessProfile,
  publishedContact,
  isPublicHttpUrl,
  isColor,
};
