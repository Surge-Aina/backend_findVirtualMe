const mongoose = require("mongoose");
const { sendError } = require("./errors");

/**
 * Fixed window, keyed by API key id (or installation id for an OAuth token).
 * The counter lives in Mongo so every process shares it. If that write fails,
 * this process applies the same limit locally instead of failing open.
 */

const buckets = new Map();

const rateBucketSchema = new mongoose.Schema(
  {
    _id: { type: String },
    count: { type: Number, default: 0 },
    expireAt: { type: Date, required: true },
  },
  { versionKey: false }
);

rateBucketSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const RateBucket =
  mongoose.models.ApiRateBucket ||
  mongoose.model("ApiRateBucket", rateBucketSchema, "api_rate_buckets");

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

function localIncrement(keyId, windowMs) {
  const now = Date.now();
  sweep(now);
  let bucket = buckets.get(keyId);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(keyId, bucket);
  }
  bucket.count += 1;
  return { count: bucket.count, resetAt: bucket.resetAt };
}

async function mongoIncrement(keyId, windowMs) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = `${keyId}:${windowStart}`;
  const expireAt = new Date(windowStart + windowMs + 60_000);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const doc = await RateBucket.findOneAndUpdate(
        { _id: id },
        { $inc: { count: 1 }, $setOnInsert: { expireAt } },
        { upsert: true, new: true }
      );
      if (!doc || typeof doc.count !== "number") {
        throw new Error("rate counter missing");
      }
      return { count: doc.count, resetAt: windowStart + windowMs };
    } catch (err) {
      if (err && err.code === 11000 && attempt === 0) continue;
      throw err;
    }
  }
  throw new Error("rate counter missing");
}

let sharedCounter = mongoIncrement;

function setSharedRateCounter(fn) {
  sharedCounter = typeof fn === "function" ? fn : mongoIncrement;
}

async function publicApiRateLimit(req, res, next) {
  const keyId = req.publicApi?.key?._id?.toString();
  if (!keyId) {
    return sendError(res, 401, "invalid_api_key", "Invalid or revoked API key");
  }

  const { max, windowMs } = limits();
  let count;
  let resetAt;
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("mongo unavailable");
    }
    ({ count, resetAt } = await sharedCounter(keyId, windowMs));
  } catch (_err) {
    console.error("public_api_rate_limit_degraded");
    ({ count, resetAt } = localIncrement(keyId, windowMs));
  }

  const resetSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  res.set("RateLimit-Limit", String(max));
  res.set("RateLimit-Remaining", String(Math.max(0, max - count)));
  res.set("RateLimit-Reset", String(resetSeconds));

  if (count > max) {
    res.set("Retry-After", String(resetSeconds));
    return sendError(res, 429, "rate_limited", "API key rate limit exceeded");
  }
  return next();
}

function resetPublicApiRateLimits() {
  buckets.clear();
  setSharedRateCounter(null);
}

module.exports = {
  publicApiRateLimit,
  resetPublicApiRateLimits,
  setSharedRateCounter,
};
