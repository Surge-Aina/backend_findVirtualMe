const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/;

const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "login",
  "signup",
  "dashboard",
  "www",
  "mcp",
  "oauth",
  "docs",
  "developers",
  "settings",
  "static",
  "assets",
]);

const MAX_THEME_ID_LEN = 64;
const MAX_THEME_TOKEN_KEY_LEN = 64;
const MAX_THEME_TOKEN_VALUE_LEN = 256;
const MAX_THEME_TOKEN_KEYS = 64;

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isForbiddenKey(key) {
  return key === "__proto__" || key === "constructor" || (typeof key === "string" && key.startsWith("$"));
}

function assertPublicSlug(slug) {
  const normalized = String(slug || "").trim().toLowerCase();
  if (!SLUG_PATTERN.test(normalized)) {
    const err = new Error("slug format is invalid");
    err.code = "INVALID_SLUG";
    throw err;
  }
  if (RESERVED_SLUGS.has(normalized)) {
    const err = new Error("slug is reserved");
    err.code = "RESERVED_SLUG";
    throw err;
  }
  return normalized;
}

function assertThemeId(themeId) {
  const value = String(themeId ?? "").trim();
  if (value.length > MAX_THEME_ID_LEN) {
    const err = new Error("themeId is too long");
    err.code = "INVALID_THEME_ID";
    throw err;
  }
  return value;
}

function assertFlatThemeTokens(themeTokens) {
  if (themeTokens === undefined || themeTokens === null) return {};
  if (!isPlainObject(themeTokens)) {
    const err = new Error("themeTokens must be an object");
    err.code = "INVALID_THEME_TOKENS";
    throw err;
  }
  const out = {};
  const entries = Object.entries(themeTokens);
  if (entries.length > MAX_THEME_TOKEN_KEYS) {
    const err = new Error("themeTokens has too many keys");
    err.code = "INVALID_THEME_TOKENS";
    throw err;
  }
  for (const [key, value] of entries) {
    if (isForbiddenKey(key)) {
      const err = new Error("themeTokens contains a disallowed key");
      err.code = "INVALID_THEME_TOKENS";
      throw err;
    }
    if (typeof value !== "string") {
      const err = new Error("themeTokens values must be strings");
      err.code = "INVALID_THEME_TOKENS";
      throw err;
    }
    const safeKey = String(key).slice(0, MAX_THEME_TOKEN_KEY_LEN);
    out[safeKey] = String(value).slice(0, MAX_THEME_TOKEN_VALUE_LEN);
  }
  return out;
}

module.exports = {
  SLUG_PATTERN,
  RESERVED_SLUGS,
  assertPublicSlug,
  assertThemeId,
  assertFlatThemeTokens,
};