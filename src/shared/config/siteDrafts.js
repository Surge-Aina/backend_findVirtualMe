/**
 * When SITE_DRAFTS_ENABLED is exactly "true", owner portfolio edits are stored
 * as drafts until publish; public reads continue to serve the last published document.
 */
function isSiteDraftsEnabled() {
  return process.env.SITE_DRAFTS_ENABLED === "true";
}

module.exports = {
  isSiteDraftsEnabled,
};