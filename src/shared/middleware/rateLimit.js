/**
 * In-memory fixed-window limiter. Enough for a single instance and for tests.
 * Render can run more than one instance, so this is a per-process guard, not a
 * global quota.
 */
function createRateLimiter({ windowMs, max, name, keyFn }) {
  const buckets = new Map();

  function middleware(req, res, next) {
    const now = Date.now();
    const key = `${name}:${keyFn(req) || "unknown"}`;
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: "Too many requests" });
    }
    recent.push(now);
    buckets.set(key, recent);
    return next();
  }

  middleware.reset = () => buckets.clear();
  return middleware;
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

module.exports = {
  createRateLimiter,
  clientIp,
};
