/**
 * Fixed-window limiter shared across processes via the api_rate_buckets
 * collection. If that write fails, this process applies the same limit
 * locally instead of failing open.
 */
const mongoose = require("mongoose");
const proxyAddr = require("proxy-addr");

const trustOneHop = (_addr, index) => index < 1;

const rateBucketSchema = new mongoose.Schema(
  {
    _id: { type: String },
    count: { type: Number, default: 0 },
    expireAt: { type: Date, required: true },
  },
  { versionKey: false },
);

rateBucketSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

function bucketModel() {
  return (
    mongoose.models.ApiRateBucket ||
    mongoose.model("ApiRateBucket", rateBucketSchema, "api_rate_buckets")
  );
}

function createRateLimiter({ windowMs, max, name, keyFn }) {
  const buckets = new Map();

  function localIncrement(key) {
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    recent.push(now);
    buckets.set(key, recent);
    return recent.length;
  }

  async function sharedIncrement(key) {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const id = `${key}:${windowStart}`;
    const expireAt = new Date(windowStart + windowMs + 60_000);
    const RateBucket = bucketModel();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const doc = await RateBucket.findOneAndUpdate(
          { _id: id },
          { $inc: { count: 1 }, $setOnInsert: { expireAt } },
          { upsert: true, new: true },
        );
        if (!doc || typeof doc.count !== "number") {
          throw new Error("rate counter missing");
        }
        return doc.count;
      } catch (err) {
        if (err && err.code === 11000 && attempt === 0) continue;
        throw err;
      }
    }
    throw new Error("rate counter missing");
  }

  async function middleware(req, res, next) {
    const key = `${name}:${keyFn(req) || "unknown"}`;
    let count;
    try {
      if (mongoose.connection.readyState !== 1) {
        throw new Error("mongo unavailable");
      }
      count = await sharedIncrement(key);
    } catch (err) {
      console.error("rate_limit_degraded", name);
      count = localIncrement(key);
    }
    if (count > max) {
      return res.status(429).json({ error: "Too many requests" });
    }
    return next();
  }

  middleware.reset = async () => {
    buckets.clear();
    if (mongoose.connection.readyState !== 1) return;
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await bucketModel().deleteMany({ _id: { $regex: `^${escaped}:` } });
  };

  return middleware;
}

function clientIp(req) {
  try {
    return proxyAddr(req, trustOneHop);
  } catch (_err) {
    return req.socket?.remoteAddress || "unknown";
  }
}

module.exports = {
  createRateLimiter,
  clientIp,
};
