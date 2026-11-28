/**
 * When MCP_SITE_TOOLS_ENABLED is exactly "true", MCP and public v1 expose
 * create/get/update site content, settings, and publish flows (sites:read / sites:write).
 */
function isMcpSiteToolsEnabled() {
  return process.env.MCP_SITE_TOOLS_ENABLED === "true";
}

module.exports = {
  isMcpSiteToolsEnabled,
};