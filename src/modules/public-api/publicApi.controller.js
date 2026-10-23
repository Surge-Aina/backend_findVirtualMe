const sitesService = require("./sites.service");
const leadsService = require("./leads.service");
const { parseLimit, decodeCursor } = require("./cursor");
const { sendError } = require("./errors");

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
    },
  });
};

exports.listSites = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const page = await sitesService.listSites({
      ownerId: ownerId(req),
      limit,
      cursor,
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
    const profile = await sitesService.getBusinessProfile({
      ownerId: ownerId(req),
      siteId: req.query.siteId,
    });
    if (!profile) return sendError(res, 404, "not_found", "Business profile not found");
    return res.status(200).json({ data: profile });
  } catch (_err) {
    console.error("public_api_request_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
};

exports.getLead = async (req, res) => {
  try {
    const lead = await leadsService.getLead({
      ownerId: ownerId(req),
      leadId: req.params.leadId,
      siteId: req.publicApi.siteId || null,
    });
    if (!lead) return sendError(res, 404, "not_found", "Lead not found");
    return res.status(200).json({ data: lead });
  } catch (_err) {
    console.error("public_api_request_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
};
