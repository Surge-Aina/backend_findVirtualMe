const mongoose = require("mongoose");

const COLLECTION = "phone_otp_lockouts";
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

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

function lockoutDocId(phoneHash) {
  return `ph:${phoneHash}`;
}

async function getLockoutState(phoneHash) {
  const col = await nativeCollection();
  const doc = await col.findOne({ _id: lockoutDocId(phoneHash) });
  if (!doc) return { locked: false, failedAttempts: 0 };
  if (doc.lockedUntil && doc.lockedUntil.getTime() > Date.now()) {
    return { locked: true, failedAttempts: doc.failedAttempts || 0 };
  }
  return { locked: false, failedAttempts: doc.failedAttempts || 0 };
}

async function recordFailedVerification(phoneHash) {
  const col = await nativeCollection();
  await ensureIndex(col);
  const id = lockoutDocId(phoneHash);
  const now = Date.now();
  const doc = await col.findOne({ _id: id });
  const previous = (doc && doc.failedAttempts) || 0;
  const failedAttempts = previous + 1;
  const update = {
    failedAttempts,
    expireAt: new Date(now + 24 * 60 * 60 * 1000),
  };
  if (failedAttempts >= MAX_FAILED) {
    update.lockedUntil = new Date(now + LOCKOUT_MS);
    update.failedAttempts = 0;
  }
  await col.updateOne({ _id: id }, { $set: update }, { upsert: true });
  return update.lockedUntil ? { locked: true } : { locked: false, failedAttempts };
}

async function clearLockout(phoneHash) {
  const col = await nativeCollection();
  await col.deleteOne({ _id: lockoutDocId(phoneHash) });
}

async function resetLockoutsForTests() {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  const col = await nativeCollection();
  await col.deleteMany({});
}

module.exports = {
  getLockoutState,
  recordFailedVerification,
  clearLockout,
  resetLockoutsForTests,
  MAX_FAILED,
};