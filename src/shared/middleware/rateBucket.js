/**
 * Shared fixed-window counters in api_rate_buckets.
 *
 * Writes go through the native driver. A Mongoose model upsert applied
 * schema defaults and built the TTL index on the same path as the counter,
 * and any failure there was swallowed as rate_limit_degraded. Index repair
 * is separate from the increment so a bad expireAt index cannot block the
 * counter.
 */
const mongoose = require("mongoose");

const COLLECTION = "api_rate_buckets";

let indexTask = null;

function errorClass(err) {
  const name = String((err && err.name) || "Error").replace(/[^A-Za-z0-9_]/g, "").slice(0, 80) || "Error";
  const rawCode = err && (err.code != null && err.code !== "" ? err.code : err.codeName);
  if (rawCode == null || rawCode === "") return name;
  const code = String(rawCode).replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
  return code ? `${name}:${code}` : name;
}

function nativeCollection() {
  const db = mongoose.connection && mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    const err = new Error("mongo unavailable");
    err.name = "MongoUnavailableError";
    throw err;
  }
  return db.collection(COLLECTION);
}

function countFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return null;
  const numeric = typeof value === "object" && typeof value.valueOf === "function"
    ? Number(value.valueOf())
    : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function repairIndex(col) {
  let indexes = [];
  try {
    indexes = await col.indexes();
  } catch (err) {
    // 26: collection does not exist yet. createIndex creates it.
    if (!err || err.code !== 26) throw err;
  }

  const existing = indexes.find((idx) => idx && idx.key && idx.key.expireAt === 1);
  if (existing && Number(existing.expireAfterSeconds) === 0) return;

  if (existing && existing.name) {
    await col.dropIndex(existing.name);
  }
  await col.createIndex({ expireAt: 1 }, { name: "expireAt_1", expireAfterSeconds: 0 });
}

function ensureRateBucketIndex() {
  if (!indexTask) {
    indexTask = (async () => {
      try {
        await repairIndex(nativeCollection());
      } catch (err) {
        console.error("rate_limit_index", errorClass(err));
      }
    })();
  }
  return indexTask;
}

async function incrementRateBucket(key, windowMs) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = `${key}:${windowStart}`;
  const expireAt = new Date(windowStart + windowMs + 60_000);
  await ensureRateBucketIndex();
  const col = nativeCollection();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await col.updateOne(
        { _id: id },
        { $inc: { count: 1 }, $setOnInsert: { expireAt } },
        { upsert: true },
      );
      const doc = await col.findOne({ _id: id }, { projection: { count: 1 } });
      const count = countFrom(doc && doc.count);
      if (count == null) {
        const err = new Error("rate counter missing");
        err.name = "RateCounterError";
        throw err;
      }
      return { count, resetAt: windowStart + windowMs };
    } catch (err) {
      if (err && err.code === 11000 && attempt === 0) continue;
      throw err;
    }
  }

  const err = new Error("rate counter missing");
  err.name = "RateCounterError";
  throw err;
}

async function deleteRateBucketsByPrefix(prefix) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await nativeCollection().deleteMany({ _id: { $regex: `^${escaped}:` } });
}

function resetRateBucketStateForTests() {
  indexTask = null;
}

module.exports = {
  incrementRateBucket,
  deleteRateBucketsByPrefix,
  ensureRateBucketIndex,
  errorClass,
  resetRateBucketStateForTests,
};
