const { CustomOAuthError } = require("@modelcontextprotocol/sdk/server/auth/errors.js");

const CONNECTOR_REDIRECT_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)*claude\.ai(\/|$)/i,
  /^https:\/\/([a-z0-9-]+\.)*chatgpt\.com(\/|$)/i,
  /^https:\/\/([a-z0-9-]+\.)*grok\.com(\/|$)/i,
  /^https:\/\/([a-z0-9-]+\.)*x\.ai(\/|$)/i,
];

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

function isAllowedMcpOAuthRedirect(uri) {
  if (typeof uri !== "string" || !uri.trim()) return false;
  let parsed;
  try {
    parsed = new URL(uri);
  } catch (_err) {
    return false;
  }
  if (parsed.protocol !== "https:" && !LOOPBACK.test(uri)) return false;
  const href = parsed.href;
  if (LOOPBACK.test(href)) return true;
  return CONNECTOR_REDIRECT_PATTERNS.some((pattern) => pattern.test(href));
}

function assertAllowedMcpOAuthRedirect(uri) {
  if (!isAllowedMcpOAuthRedirect(uri)) {
    throw new CustomOAuthError("invalid_redirect_uri", "redirect_uri is not allowed for MCP OAuth");
  }
  return new URL(uri).href;
}

module.exports = {
  isAllowedMcpOAuthRedirect,
  assertAllowedMcpOAuthRedirect,
  CONNECTOR_REDIRECT_PATTERNS,
};