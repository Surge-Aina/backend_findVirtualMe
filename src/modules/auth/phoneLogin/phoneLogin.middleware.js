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
  const e164 = normalizeE164(req.body && req.body.phone);
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

function handleServiceError(res, err) {
  const status = err && typeof err.status === "number" ? err.status : 500;
  const message =
    status >= 500 ? "Server error" : err.message || "Request failed";
  if (status >= 500) {
    console.error("phone_login_error", err && err.message ? err.message : "Error");
  }
  return res.status(status).json({ message });
}

module.exports = {
  requirePhoneLoginFeature,
  sendRateLimits,
  handleServiceError,
};