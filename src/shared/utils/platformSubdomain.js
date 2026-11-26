const DNS_LABEL =
  /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/;

const RESERVED_PLATFORM_LABELS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "dev",
  "staging",
  "mail",
  "email",
  "autodiscover",
]);

function platformBaseHost() {
  const raw = (process.env.PUBLIC_SITE_HOST || "findvirtual.me")
    .trim()
    .toLowerCase();
  const host = raw
    .replace(/^\.+|\.+$/g, "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
  return host || "findvirtual.me";
}

function baseHostParts() {
  return platformBaseHost().split(".").filter(Boolean);
}

/**
 * @param {string} hostname
 * @returns {string|null} customer slug when host is exactly `<label>.<platformBase>`
 */
function extractPlatformCustomerSlugFromHostname(hostname) {
  if (!hostname || typeof hostname !== "string") return null;

  const normalized = hostname.trim().toLowerCase();
  if (!normalized || normalized.includes(":")) return null;

  const base = platformBaseHost();
  const baseParts = baseHostParts();
  if (baseParts.length === 0) return null;

  const labels = normalized.split(".").filter(Boolean);
  if (labels.length !== baseParts.length + 1) return null;

  const suffix = labels.slice(-baseParts.length).join(".");
  if (suffix !== base) return null;

  const slug = labels[0];
  if (!DNS_LABEL.test(slug)) return null;

  return slug;
}

/**
 * @param {string} origin full Origin header value
 * @returns {string|null}
 */
function extractPlatformCustomerSlugFromOrigin(origin) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port) return null;
  if (parsed.pathname !== "/" && parsed.pathname !== "") return null;
  if (parsed.search || parsed.hash) return null;

  return extractPlatformCustomerSlugFromHostname(parsed.hostname);
}

function isPlatformCustomerOrigin(origin) {
  return extractPlatformCustomerSlugFromOrigin(origin) !== null;
}

module.exports = {
  DNS_LABEL,
  RESERVED_PLATFORM_LABELS,
  platformBaseHost,
  extractPlatformCustomerSlugFromHostname,
  extractPlatformCustomerSlugFromOrigin,
  isPlatformCustomerOrigin,
};