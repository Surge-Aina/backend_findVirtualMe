const apiKeyService = require("./apiKey.service");
const { ApiKeyError } = apiKeyService;
const { sendError } = require("./errors");

function userIdFrom(req) {
  return req.user?._id || req.user?.id;
}

function handle(res, err) {
  if (err instanceof ApiKeyError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }
  console.error("developer_api_key_error");
  return sendError(res, 500, "internal_error", "Internal server error");
}

exports.create = async (req, res) => {
  try {
    const result = await apiKeyService.createKey({
      userId: userIdFrom(req),
      name: req.body?.name,
      scopes: req.body?.scopes,
    });
    return res.status(201).json({
      data: result.apiKey,
      secret: result.secret,
      note: "Store this secret now. It cannot be retrieved again.",
    });
  } catch (err) {
    return handle(res, err);
  }
};

exports.list = async (req, res) => {
  try {
    const data = await apiKeyService.listKeys(userIdFrom(req));
    return res.status(200).json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.revoke = async (req, res) => {
  try {
    const data = await apiKeyService.revokeKey({
      userId: userIdFrom(req),
      keyId: req.params.id,
    });
    return res.status(200).json({ data });
  } catch (err) {
    return handle(res, err);
  }
};

exports.rotate = async (req, res) => {
  try {
    const result = await apiKeyService.rotateKey({
      userId: userIdFrom(req),
      keyId: req.params.id,
    });
    return res.status(201).json({
      data: result.apiKey,
      secret: result.secret,
      revokedKeyId: result.revokedKeyId,
      note: "Store this secret now. It cannot be retrieved again.",
    });
  } catch (err) {
    return handle(res, err);
  }
};
