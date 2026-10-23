const { sendError } = require("./errors");

const API_VERSION = "2026-10-23";

function apiVersion(req, res, next) {
  const requested = req.get("Version");
  if (requested && requested !== API_VERSION) {
    return sendError(res, 400, "unsupported_version", "Version is not supported", {
      supported: [API_VERSION],
    });
  }
  res.set("Version", API_VERSION);
  next();
}

module.exports = {
  API_VERSION,
  apiVersion,
};
