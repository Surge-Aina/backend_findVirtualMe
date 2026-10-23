const { sendError } = require("./errors");

/**
 * In-process fixed window, keyed by API key id.
 * A later slice can replace this map with a shared store. No external service
 * is used here, so each app process enforces its own window.
 */
const buckets = new Map();

function readPositiveInt(name, fallback, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  if (parsed < 1 || parsed > max) return fallback;
  return parsed;
}

function limits() {
  return {
    max: readPositiveInt("PUBLIC_API_RATE_LIMIT_MAX", 60, 10000),
    windowMs: readPositiveInt("PUBLIC_API_RATE_LIMIT_WINDOW_MS", 60000, 24 * 60 * 60 * 1000),
  };
}

function sweep(now) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

function publicApiRateLimit(req, res, next) {
  const keyId = req.publicApi?.key?._id?.toString();
  if (!keyId) return next();

  const { max, windowMs } = limits();
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(keyId);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(keyId, bucket);
  }

  bucket.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.set("RateLimit-Limit", String(max));
  res.set("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
  res.set("RateLimit-Reset", String(resetSeconds));

  if (bucket.count > max) {
    res.set("Retry-After", String(resetSeconds));
    return sendError(res, 429, "rate_limited", "API key rate limit exceeded");
  }
  return next();
}

function resetPublicApiRateLimits() {
  buckets.clear();
}

module.exports = {
  publicApiRateLimit,
  resetPublicApiRateLimits,
};
