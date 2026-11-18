const mongoose = require("mongoose");
const { getOtpDailyCap } = require("./phoneLogin.config");

const COLLECTION = "otp_daily_send_counters";

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function expireAtForDay(dayKey) {
  const start = Date.parse(`${dayKey}T00:00:00.000Z`);
  return new Date(start + 48 * 60 * 60 * 1000);
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
    // best-effort in test/dev
  }
}

/**
 * Atomically increments the global UTC-day OTP send counter.
 * @returns {{ allowed: boolean, count: number, cap: number }}
 */
async function consumeGlobalDailyOtpSend() {
  const cap = getOtpDailyCap();
  const dayKey = utcDayKey();
  const col = await nativeCollection();
  await ensureIndex(col);
  const expireAt = expireAtForDay(dayKey);

  await col.updateOne(
    { _id: dayKey },
    { $inc: { count: 1 }, $setOnInsert: { expireAt } },
    { upsert: true },
  );

  const doc = await col.findOne({ _id: dayKey });
  const count = doc && typeof doc.count === "number" ? doc.count : 0;
  return { allowed: count <= cap, count, cap };
}

async function resetDailyOtpCountersForTests() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  const col = await nativeCollection();
  await col.deleteMany({});
}

module.exports = {
  consumeGlobalDailyOtpSend,
  resetDailyOtpCountersForTests,
  utcDayKey,
};