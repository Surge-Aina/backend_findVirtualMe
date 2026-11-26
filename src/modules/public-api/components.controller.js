const { sendError } = require("./errors");
const { installedSiteId } = require("./publicApi.auth");
const componentService = require("../portfolios/component.service");

function ownerId(req) {
  return req.publicApi.user._id;
}

function writeContext(req, siteId) {
  return componentService.buildExternalWriteContext(req.publicApi, siteId);
}

function assertSiteAccess(req, res, siteId) {
  const onlySiteId = installedSiteId(req);
  if (onlySiteId && onlySiteId !== String(siteId)) {
    sendError(res, 404, "not_found", "Site not found");
    return false;
  }
  return true;
}

function mapServiceError(res, err) {
  if (err.name === "FeatureComponentsError" || err.name === "ComponentConfigError") {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  console.error("public_api_components_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

exports.listComponents = async (req, res) => {
  try {
    const siteId = req.params.id;
    if (!assertSiteAccess(req, res, siteId)) return;

    const listed = await componentService.listAvailableComponents({
      ownerId: ownerId(req),
      siteId,
    });
    if (!listed) return sendError(res, 404, "not_found", "Site not found");

    const { siteId: _omit, template, ...puckPayload } = listed;
    return res.status(200).json({
      data: {
        siteId: String(siteId),
        template,
        ...puckPayload,
      },
    });
  } catch (err) {
    return mapServiceError(res, err);
  }
};

exports.addComponent = async (req, res) => {
  try {
    const siteId = req.params.id;
    if (!assertSiteAccess(req, res, siteId)) return;

    const body = req.body || {};
    const typeInput = body.type ?? body.componentId;
    if (typeof typeInput !== "string" || !typeInput.trim()) {
      return sendError(res, 400, "validation_error", "type is required (Puck component type)", {
        field: "type",
      });
    }

    const result = await componentService.addComponent(writeContext(req, siteId), {
      type: typeInput.trim(),
      props: body.props,
      config: body.config,
      order: body.order,
    });

    return res.status(201).json({ data: result });
  } catch (err) {
    return mapServiceError(res, err);
  }
};

exports.updateComponent = async (req, res) => {
  try {
    const siteId = req.params.id;
    const sectionId = req.params.sectionId;
    if (!assertSiteAccess(req, res, siteId)) return;

    const result = await componentService.updateComponent(writeContext(req, siteId), {
      sectionId,
      props: req.body?.props,
      config: req.body?.config,
    });

    return res.status(200).json({ data: result });
  } catch (err) {
    return mapServiceError(res, err);
  }
};

exports.removeComponent = async (req, res) => {
  try {
    const siteId = req.params.id;
    const sectionId = req.params.sectionId;
    if (!assertSiteAccess(req, res, siteId)) return;

    const result = await componentService.removeComponent(writeContext(req, siteId), {
      sectionId,
    });

    return res.status(200).json({ data: result });
  } catch (err) {
    return mapServiceError(res, err);
  }
};

exports.reorderComponents = async (req, res) => {
  try {
    const siteId = req.params.id;
    if (!assertSiteAccess(req, res, siteId)) return;

    const sectionIds = req.body?.sectionIds;
    const result = await componentService.reorderComponents(writeContext(req, siteId), {
      sectionIds,
    });

    return res.status(200).json({ data: result });
  } catch (err) {
    return mapServiceError(res, err);
  }
};