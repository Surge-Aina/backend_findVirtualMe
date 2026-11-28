const { phoneLoginEnabled } = require("./phoneLogin.config");
const { createRateLimiter, clientIp } = require("../../../shared/middleware/rateLimit");
const { normalizeE164, phoneLookupHash } = require("./phoneCrypto");

function requirePhoneLoginFeature(req, res, next) {
  if (!phoneLoginEnabled()) {
    return next("router");
  }
  return next();
}

function phoneFromBody(req) {
  const body = req.body || {};
  const country = body.country ? String(body.country).trim().toUpperCase() : undefined;
  let e164;
  try {
    e164 = normalizeE164(body.phone, country);
  } catch (_err) {
    return "unknown";
  }
  if (!e164) return "unknown";
  return phoneLookupHash(e164) || "unknown";
}

const sendPhonePerMinute = createRateLimiter({
  windowMs: 60 * 1000,
  max: 1,
  name: "phone_otp_send_phone_min",
  keyFn: phoneFromBody,
});

const sendPhonePerHour = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: "phone_otp_send_phone_hour",
  keyFn: phoneFromBody,
});

const sendIpPerHour = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  name: "phone_otp_send_ip_hour",
  keyFn: clientIp,
});

const sendRateLimits = [sendPhonePerMinute, sendPhonePerHour, sendIpPerHour];

const verifyIpPerHour = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  name: "phone_otp_verify_ip_hour",
  keyFn: clientIp,
});

const verifyRateLimits = [verifyIpPerHour];

function handleServiceError(res, err) {
  const status = err && typeof err.status === "number" ? err.status : 500;
  const message =
    status >= 500 ? "Server error" : err.message || "Request failed";
  if (status >= 500) {
    const errName = err && err.name ? String(err.name).replace(/[^A-Za-z0-9_]/g, "") : "Error";
    const errCode = err && err.code != null ? String(err.code) : "";
    console.error("phone_login_error", errName, errCode);
  }
  const body = { message };
  if (err && err.code) body.code = err.code;
  return res.status(status).json(body);
}

module.exports = {
  requirePhoneLoginFeature,
  sendRateLimits,
  verifyRateLimits,
  handleServiceError,
};