const sitesService = require("./sites.service");
const { parseLimit, decodeCursor } = require("./cursor");
const { sendError } = require("./errors");
const { installedSiteId } = require("./publicApi.auth");
const { listLeads } = require("./leads.service");
const { updateSiteContent, SiteContentError } = require("./siteContent");
const { uninstallInstallation, MarketplaceError } = require("../marketplace/oauth.service");
const { listEndpoints } = require("./webhook.service");
const { listInstallations } = require("../marketplace/oauth.service");

function ownerId(req) {
  return req.publicApi.user._id;
}

function sendQueryError(res, err) {
  if (err && (err.code === "invalid_cursor" || err.code === "invalid_limit")) {
    const field = err.code === "invalid_cursor" ? "cursor" : "limit";
    return sendError(res, 400, "validation_error", err.message, { field });
  }
  console.error("public_api_request_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

exports.me = (req, res) => {
  const user = req.publicApi.user;
  return res.status(200).json({
    data: {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      active: user.isActive !== false,
      createdAt: user.createdAt,
      ...(installedSiteId(req) ? { siteId: installedSiteId(req) } : {}),
    },
  });
};

exports.listSites = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const onlySiteId = installedSiteId(req);
    const page = await sitesService.listSites({
      ownerId: ownerId(req),
      limit,
      cursor: onlySiteId ? null : cursor,
      onlySiteId,
    });
    return res.status(200).json({
      data: page.sites,
      page: {
        limit,
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
      },
    });
  } catch (err) {
    return sendQueryError(res, err);
  }
};

exports.getSite = async (req, res) => {
  try {
    const onlySiteId = installedSiteId(req);
    if (onlySiteId && onlySiteId !== String(req.params.id)) {
      return sendError(res, 404, "not_found", "Site not found");
    }
    const site = await sitesService.getSite({
      ownerId: ownerId(req),
      siteId: req.params.id,
    });
    if (!site) return sendError(res, 404, "not_found", "Site not found");
    return res.status(200).json({ data: site });
  } catch (_err) {
    console.error("public_api_request_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
};

exports.businessProfile = async (req, res) => {
  try {
    if (req.query.siteId !== undefined && typeof req.query.siteId !== "string") {
      return sendError(res, 400, "validation_error", "siteId is invalid", {
        field: "siteId",
      });
    }
    const onlySiteId = installedSiteId(req);
    if (onlySiteId && req.query.siteId && req.query.siteId !== onlySiteId) {
      return sendError(res, 404, "not_found", "Business profile not found");
    }
    const profile = await sitesService.getBusinessProfile({
      ownerId: ownerId(req),
      siteId: onlySiteId || req.query.siteId,
    });
    if (!profile) return sendError(res, 404, "not_found", "Business profile not found");
    return res.status(200).json({ data: profile });
  } catch (_err) {
    console.error("public_api_request_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
};

exports.listLeads = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const page = await listLeads({
      ownerId: ownerId(req),
      limit,
      cursor,
      onlySiteId: installedSiteId(req),
    });
    return res.status(200).json({
      data: page.leads,
      page: { limit, hasMore: page.hasMore, nextCursor: page.nextCursor },
    });
  } catch (err) {
    return sendQueryError(res, err);
  }
};

exports.updateContent = async (req, res) => {
  try {
    const onlySiteId = installedSiteId(req);
    if (onlySiteId && onlySiteId !== String(req.params.id)) {
      return sendError(res, 404, "not_found", "Site not found");
    }
    const data = await updateSiteContent({
      ownerId: ownerId(req),
      siteId: req.params.id,
      field: req.body?.field,
      value: req.body?.value,
      sectionId: req.body?.sectionId,
    });
    return res.status(200).json({ data });
  } catch (err) {
    if (err instanceof SiteContentError) {
      return sendError(res, err.status, err.code, err.message, err.details);
    }
    console.error("public_api_request_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
};

exports.uninstall = async (req, res) => {
  try {
    if (!req.publicApi.installationId) {
      return sendError(res, 404, "not_found", "Installation not found");
    }
    const data = await uninstallInstallation({
      userId: ownerId(req),
      installationId: req.publicApi.installationId,
    });
    return res.status(200).json({ data });
  } catch (err) {
    if (err instanceof MarketplaceError) {
      return sendError(res, err.status, err.code, err.message, err.details);
    }
    console.error("public_api_request_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
};

async function listIntegrations(userId) {
  const [installations, webhooks] = await Promise.all([
    listInstallations(userId),
    listEndpoints(userId),
  ]);
  return {
    installations: installations.map((item) => ({
      id: item.id,
      appId: item.appId,
      appName: item.appName,
      slug: item.slug,
      siteId: item.siteId,
      scopes: item.scopes,
      status: item.status,
    })),
    webhooks: webhooks.map((item) => ({
      id: item.id,
      url: item.url,
      events: item.events,
      secretLast4: item.secretLast4,
      appId: item.appId,
      installationId: item.installationId,
    })),
  };
}

exports.listIntegrations = listIntegrations;
