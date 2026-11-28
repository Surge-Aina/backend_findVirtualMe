const { PUBLIC_API_SCOPES } = require("../../modules/public-api/scopes");

/** Scopes offered on the MCP OAuth consent screen (connector use). */
const MCP_OAUTH_CONSENT_SCOPES = Object.freeze([
  "sites:read",
  "profile:read",
  "leads:read",
  "sites:write",
]);

function isMcpOAuthEnabled() {
  return process.env.MCP_OAUTH_ENABLED === "true";
}

function readPositiveInt(name, fallback, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, max);
}

function publicApiBaseUrl() {
  const raw =
    process.env.PUBLIC_API_BASE_URL ||
    process.env.MCP_OAUTH_ISSUER_URL ||
    "https://api.findvirtual.me";
  return String(raw).trim().replace(/\/+$/, "");
}

function mcpOAuthIssuerUrl() {
  const base = publicApiBaseUrl();
  if (!base) throw new Error("MCP OAuth issuer URL is not configured");
  return new URL(base);
}

function mcpResourceUrl() {
  return new URL("/api/mcp", mcpOAuthIssuerUrl());
}

function mcpAccessTtlMs() {
  return readPositiveInt("MCP_OAUTH_ACCESS_TTL_SECONDS", 900, 86400) * 1000;
}

function mcpRefreshTtlMs() {
  return readPositiveInt("MCP_OAUTH_REFRESH_TTL_SECONDS", 30 * 24 * 60 * 60, 90 * 24 * 60 * 60) * 1000;
}

function mcpCodeTtlMs() {
  return readPositiveInt("MCP_OAUTH_CODE_TTL_SECONDS", 300, 600) * 1000;
}

module.exports = {
  MCP_OAUTH_CONSENT_SCOPES,
  PUBLIC_API_SCOPES,
  isMcpOAuthEnabled,
  publicApiBaseUrl,
  mcpOAuthIssuerUrl,
  mcpResourceUrl,
  mcpAccessTtlMs,
  mcpRefreshTtlMs,
  mcpCodeTtlMs,
};