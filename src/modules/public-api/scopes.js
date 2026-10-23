/**
 * Scopes for public API v1.
 * Add new scopes here when a later resource is exposed.
 */
const PUBLIC_API_SCOPES = Object.freeze([
  "sites:read",
  "sites:write",
  "profile:read",
  "leads:read",
  "webhooks:write",
  "custom_fields:read",
  "custom_fields:write",
  "workflows:read",
  "workflows:write",
]);

const PUBLIC_API_SCOPE_SET = new Set(PUBLIC_API_SCOPES);

function isPublicApiScope(scope) {
  return PUBLIC_API_SCOPE_SET.has(scope);
}

module.exports = {
  PUBLIC_API_SCOPES,
  isPublicApiScope,
};
