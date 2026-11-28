const { sendError } = require("./errors");
const { isMcpSiteToolsEnabled } = require("../../shared/config/mcpSiteTools");
const { installedSiteId } = require("./publicApi.auth");
const siteTools = require("./siteTools.service");

function ownerId(req) {
  return req.publicApi.user._id;
}

function featureDisabled(res) {
  return sendError(res, 404, "not_found", "Unknown public API route");
}

function writeSource(req) {
  return req.publicApi?.authType === "oauth" ? "mcp" : "api";
}

function assertSiteScope(req, res, siteId) {
  const only = installedSiteId(req);
  if (only && only !== String(siteId)) {
    sendError(res, 404, "not_found", "Site not found");
    return false;
  }
  return true;
}

function handleSiteToolsError(res, err) {
  if (err instanceof siteTools.SiteToolsError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  console.error("public_api_site_tools_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

exports.createSite = async (req, res) => {
  if (!isMcpSiteToolsEnabled()) return featureDisabled(res);
  try {
    const { template, title } = req.body || {};
    const data = await siteTools.createSite({
      ownerId: ownerId(req),
      template,
      title,
    });
    return res.status(201).json({ data: data.site });
  } catch (err) {
    return handleSiteToolsError(res, err);
  }
};

exports.getSiteContent = async (req, res) => {
  if (!isMcpSiteToolsEnabled()) return featureDisabled(res);
  try {
    if (!assertSiteScope(req, res, req.params.id)) return;
    const data = await siteTools.getSiteContent({ ownerId: ownerId(req), siteId: req.params.id });
    return res.status(200).json({ data });
  } catch (err) {
    return handleSiteToolsError(res, err);
  }
};

exports.updateSiteContent = async (req, res) => {
  if (!isMcpSiteToolsEnabled()) return featureDisabled(res);
  try {
    if (!assertSiteScope(req, res, req.params.id)) return;
    const data = await siteTools.updateSiteContent({
      ownerId: ownerId(req),
      siteId: req.params.id,
      content: req.body?.content,
      source: writeSource(req),
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handleSiteToolsError(res, err);
  }
};

exports.updateSiteSettings = async (req, res) => {
  if (!isMcpSiteToolsEnabled()) return featureDisabled(res);
  try {
    if (!assertSiteScope(req, res, req.params.id)) return;
    const data = await siteTools.updateSiteSettings({
      ownerId: ownerId(req),
      siteId: req.params.id,
      settings: req.body?.settings,
      source: writeSource(req),
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handleSiteToolsError(res, err);
  }
};

exports.submitForPublish = async (req, res) => {
  if (!isMcpSiteToolsEnabled()) return featureDisabled(res);
  try {
    if (!assertSiteScope(req, res, req.params.id)) return;
    const data = await siteTools.submitForPublish({
      ownerId: ownerId(req),
      siteId: req.params.id,
      source: writeSource(req),
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handleSiteToolsError(res, err);
  }
};

exports.publishSite = async (req, res) => {
  if (!isMcpSiteToolsEnabled()) return featureDisabled(res);
  try {
    if (!assertSiteScope(req, res, req.params.id)) return;
    const data = await siteTools.publishSite({ ownerId: ownerId(req), siteId: req.params.id });
    return res.status(200).json({ data });
  } catch (err) {
    return handleSiteToolsError(res, err);
  }
};