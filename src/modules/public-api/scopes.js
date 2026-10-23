/**
 * Read scopes for public API v1.
 * Add new scopes here when a later slice exposes more partner resources.
 * Write scopes, webhook subscriptions, and OAuth grants are intentionally absent.
 */
const PUBLIC_API_SCOPES = Object.freeze(["sites:read", "profile:read"]);

const PUBLIC_API_SCOPE_SET = new Set(PUBLIC_API_SCOPES);

function isPublicApiScope(scope) {
  return PUBLIC_API_SCOPE_SET.has(scope);
}

module.exports = {
  PUBLIC_API_SCOPES,
  isPublicApiScope,
};
