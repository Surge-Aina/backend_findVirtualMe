const {
  createEndpoint,
  listEndpoints,
  deleteEndpoint,
  rotateEndpointSecret,
  listDeliveries,
  sendTestEvent,
  handleWebhookError,
} = require("./webhook.service");

function userIdFrom(req) {
  return req.publicApi?.user?._id || req.user?._id || req.user?.id;
}

exports.create = async (req, res) => {
  try {
    const result = await createEndpoint({
      userId: userIdFrom(req),
      url: req.body?.url,
      events: req.body?.events,
      appId: req.publicApi?.appId || null,
      installationId: req.publicApi?.installationId || null,
    });
    return res.status(201).json({
      data: result.endpoint,
      secret: result.secret,
      note: "Store this signing secret now. It cannot be retrieved again.",
    });
  } catch (err) {
    return handleWebhookError(res, err);
  }
};

exports.list = async (req, res) => {
  try {
    const data = await listEndpoints(userIdFrom(req), {
      installationId: req.publicApi?.installationId || null,
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handleWebhookError(res, err);
  }
};

exports.rotate = async (req, res) => {
  try {
    const result = await rotateEndpointSecret({
      userId: userIdFrom(req),
      endpointId: req.params.id,
      installationId: req.publicApi?.installationId || null,
    });
    return res.status(200).json({
      data: result.endpoint,
      secret: result.secret,
      note: "Store this signing secret now. It cannot be retrieved again.",
    });
  } catch (err) {
    return handleWebhookError(res, err);
  }
};

exports.test = async (req, res) => {
  try {
    const data = await sendTestEvent({
      userId: userIdFrom(req),
      endpointId: req.params.id,
      installationId: req.publicApi?.installationId || null,
    });
    return res.status(202).json({ data });
  } catch (err) {
    return handleWebhookError(res, err);
  }
};

exports.deliveries = async (req, res) => {
  try {
    const data = await listDeliveries({
      userId: userIdFrom(req),
      endpointId: req.params.id,
      installationId: req.publicApi?.installationId || null,
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handleWebhookError(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const data = await deleteEndpoint({
      userId: userIdFrom(req),
      endpointId: req.params.id,
      installationId: req.publicApi?.installationId || null,
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handleWebhookError(res, err);
  }
};
