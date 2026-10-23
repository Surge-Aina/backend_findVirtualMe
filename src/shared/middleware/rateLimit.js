/**
 * Fixed-window limiter shared across processes via the api_rate_buckets
 * collection. If that write fails, this process applies the same limit
 * locally instead of failing open.
 */
const mongoose = require("mongoose");
const proxyAddr = require("proxy-addr");
const {
  incrementRateBucket,
  deleteRateBucketsByPrefix,
  errorClass,
} = require("./rateBucket");

const trustOneHop = (_addr, index) => index < 1;

function createRateLimiter({ windowMs, max, name, keyFn }) {
  const buckets = new Map();

  function localIncrement(key) {
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    recent.push(now);
    buckets.set(key, recent);
    return recent.length;
  }

  async function middleware(req, res, next) {
    const key = `${name}:${keyFn(req) || "unknown"}`;
    let count;
    try {
      if (mongoose.connection.readyState !== 1) {
        const err = new Error("mongo unavailable");
        err.name = "MongoUnavailableError";
        throw err;
      }
      ({ count } = await incrementRateBucket(key, windowMs));
    } catch (err) {
      console.error("rate_limit_degraded", name, errorClass(err));
      count = localIncrement(key);
    }
    if (count > max) {
      return res.status(429).json({ error: "Too many requests" });
    }
    return next();
  }

  middleware.reset = async () => {
    buckets.clear();
    await deleteRateBucketsByPrefix(name);
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
