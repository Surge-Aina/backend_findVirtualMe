const mongoose = require("mongoose");
const {
  getSmsPumpDistinctMax,
  getSmsPumpWindowMs,
} = require("./phoneLogin.config");
const { phonePrefixForPumpGuard, phoneLookupHash } = require("./phoneCrypto");

const COLLECTION = "phone_otp_pump_guards";

function windowStart(now, windowMs) {
  return Math.floor(now / windowMs) * windowMs;
}

async function nativeCollection() {
  const db = mongoose.connection && mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    const err = new Error("mongo unavailable");
    err.name = "MongoUnavailableError";
    throw err;
  }
  return db.collection(COLLECTION);
}

async function ensureIndex(col) {
  try {
    await col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  } catch (_err) {
    // best-effort
  }
}

async function assertNotSmsPumping({ clientIp, e164 }) {
  const windowMs = getSmsPumpWindowMs();
  const maxDistinct = getSmsPumpDistinctMax();
  const prefix = phonePrefixForPumpGuard(e164);
  const phoneHash = phoneLookupHash(e164);
  if (!phoneHash || !clientIp || clientIp === "unknown") return;

  const now = Date.now();
  const start = windowStart(now, windowMs);
  const id = `pump:${clientIp}:${prefix}:${start}`;
  const expireAt = new Date(start + windowMs + 60_000);

  const col = await nativeCollection();
  await ensureIndex(col);

  const doc = await col.findOneAndUpdate(
    { _id: id },
    {
      $addToSet: { phoneHashes: phoneHash },
      $setOnInsert: { expireAt, prefix, clientIp },
    },
    { upsert: true, returnDocument: "after" },
  );

  const distinct = doc && Array.isArray(doc.phoneHashes) ? doc.phoneHashes.length : 1;
  if (distinct > maxDistinct) {
    console.error("phone_otp_pump_blocked", clientIp, `prefix_${prefix.length}d`, distinct);
    const err = new Error("Too many verification requests");
    err.status = 429;
    err.code = "PHONE_SMS_PUMP_BLOCKED";
    throw err;
  }
}

async function resetPumpGuardsForTests() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  const col = await nativeCollection();
  await col.deleteMany({});
}

module.exports = {
  assertNotSmsPumping,
  resetPumpGuardsForTests,
};