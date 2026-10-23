const mongoose = require("mongoose");
const RateBucket = require("./rateBucket.model");
const { sendError } = require("./errors");

function readPositiveInt(name, fallback, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  if (parsed < 1 || parsed > max) return fallback;
  return parsed;
}

function publicApiLimits() {
  return {
    max: readPositiveInt("PUBLIC_API_RATE_LIMIT_MAX", 60, 10000),
    windowMs: readPositiveInt("PUBLIC_API_RATE_LIMIT_WINDOW_MS", 60000, 24 * 60 * 60 * 1000),
  };
}

/**
 * Fixed window aligned to the epoch so every instance shares the boundary.
 * The counter lives in MongoDB.
 */
async function consumeRateLimit({ bucketKey, max, windowMs, now = Date.now() }) {
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expireAt = new Date(windowStartMs + windowMs * 2);
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { bucketKey, windowStart, expireAt },
  };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  let doc;
  try {
    doc = await RateBucket.findOneAndUpdate({ bucketKey, windowStart }, update, options);
  } catch (err) {
    if (!err || err.code !== 11000) throw err;
    doc = await RateBucket.findOneAndUpdate(
      { bucketKey, windowStart },
      { $inc: { count: 1 } },
      { new: true }
    );
  }

  const count = doc?.count || 1;
  const resetAt = windowStartMs + windowMs;
  return {
    allowed: count <= max,
    limit: max,
    remaining: Math.max(0, max - count),
    resetSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    count,
  };
}

function applyRateHeaders(res, result) {
  res.set("RateLimit-Limit", String(result.limit));
  res.set("RateLimit-Remaining", String(result.remaining));
  res.set("RateLimit-Reset", String(result.resetSeconds));
  if (!result.allowed) res.set("Retry-After", String(result.resetSeconds));
}

async function publicApiRateLimit(req, res, next) {
  try {
    const keyId = req.publicApi?.key?._id?.toString();
    if (!keyId) return next();
    const { max, windowMs } = publicApiLimits();
    const result = await consumeRateLimit({
      bucketKey: `public-api:${keyId}`,
      max,
      windowMs,
    });
    applyRateHeaders(res, result);
    if (!result.allowed) {
      return sendError(res, 429, "rate_limited", "API key rate limit exceeded");
    }
    return next();
  } catch (_err) {
    console.error("public_api_rate_limit_error");
    return sendError(res, 500, "internal_error", "Internal server error");
  }
}

async function resetPublicApiRateLimits() {
  if (mongoose.connection.readyState !== 1) return;
  await RateBucket.deleteMany({});
}

module.exports = {
  consumeRateLimit,
  applyRateHeaders,
  publicApiRateLimit,
  resetPublicApiRateLimits,
  publicApiLimits,
};
