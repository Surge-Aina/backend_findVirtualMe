/**
 * When FEATURE_COMPONENTS_ENABLED is exactly "true", reusable section components
 * are exposed to owners and (with drafts) to API/MCP writers with sites:write.
 */
function isFeatureComponentsEnabled() {
  return process.env.FEATURE_COMPONENTS_ENABLED === "true";
}

module.exports = {
  isFeatureComponentsEnabled,
};