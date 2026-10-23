/**
 * Scopes for public API v1.
 * OAuth grants are added with the marketplace slice.
 */
const PUBLIC_API_SCOPES = Object.freeze(["sites:read", "profile:read", "webhooks:write"]);

const PUBLIC_API_SCOPE_SET = new Set(PUBLIC_API_SCOPES);

function isPublicApiScope(scope) {
  return PUBLIC_API_SCOPE_SET.has(scope);
}

module.exports = {
  PUBLIC_API_SCOPES,
  isPublicApiScope,
};
