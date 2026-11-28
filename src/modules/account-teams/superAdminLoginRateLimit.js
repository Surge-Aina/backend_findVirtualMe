const { createRateLimiter, clientIp } = require("../../shared/middleware/rateLimit");

const WINDOW_FIFTEEN_MIN_MS = 15 * 60 * 1000;
const WINDOW_ONE_HOUR_MS = 60 * 60 * 1000;

const superAdminLoginPerIp = createRateLimiter({
  windowMs: WINDOW_FIFTEEN_MIN_MS,
  max: 5,
  name: "super_admin_login_ip",
  keyFn: clientIp,
});

const superAdminLoginGlobal = createRateLimiter({
  windowMs: WINDOW_ONE_HOUR_MS,
  max: 20,
  name: "super_admin_login_global",
  keyFn: () => "global",
});

function superAdminLoginRateLimit(req, res, next) {
  superAdminLoginGlobal(req, res, (globalErr) => {
    if (globalErr) return next(globalErr);
    superAdminLoginPerIp(req, res, next);
  });
}

module.exports = {
  superAdminLoginRateLimit,
  superAdminLoginPerIp,
  superAdminLoginGlobal,
};