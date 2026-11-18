const mongoose = require("mongoose");

const COLLECTION = "phone_otp_lockouts";
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const RECORD_TTL_MS = 60 * 60 * 1000;

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

function notLockedFilter(now = new Date()) {
  return {
    $or: [
      { lockedUntil: { $exists: false } },
      { lockedUntil: null },
      { lockedUntil: { $lte: now } },
    ],
  };
}

function isDuplicateKeyError(err) {
  return Boolean(err && err.code === 11000);
}

/**
 * Atomically reserves one verification attempt before calling Twilio.
 * At most MAX_FAILED concurrent claims succeed until lockout is applied.
 */
async function claimVerificationAttempt(phoneHash) {
  const col = await nativeCollection();
  await ensureIndex(col);
  const id = lockoutDocId(phoneHash);
  const now = new Date();

  try {
    await col.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          failedAttempts: 0,
          expireAt: new Date(Date.now() + RECORD_TTL_MS),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { claimed: false };
    }
    throw err;
  }

  try {
    const doc = await col.findOneAndUpdate(
      {
        _id: id,
        failedAttempts: { $lt: MAX_FAILED },
        ...notLockedFilter(now),
      },
      { $inc: { failedAttempts: 1 } },
      { returnDocument: "after" },
    );

    if (!doc) {
      return { claimed: false };
    }
    return { claimed: true, failedAttempts: doc.failedAttempts };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { claimed: false };
    }
    throw err;
  }
}

async function applyLockoutIfNeeded(phoneHash) {
  const col = await nativeCollection();
  const id = lockoutDocId(phoneHash);
  const now = Date.now();
  await col.updateOne(
    {
      _id: id,
      failedAttempts: { $gte: MAX_FAILED },
      ...notLockedFilter(new Date(now)),
    },
    {
      $set: {
        lockedUntil: new Date(now + LOCKOUT_MS),
        failedAttempts: 0,
        expireAt: new Date(now + RECORD_TTL_MS),
      },
    },
  );
}

async function isSendBlockedByLockout(phoneHash) {
  const col = await nativeCollection();
  const doc = await col.findOne({ _id: lockoutDocId(phoneHash) });
  if (!doc) return false;
  if (doc.lockedUntil && doc.lockedUntil.getTime() > Date.now()) return true;
  if (typeof doc.failedAttempts === "number" && doc.failedAttempts >= MAX_FAILED) {
    return true;
  }
  return false;
}

async function isVerifyBlockedByLockout(phoneHash) {
  const col = await nativeCollection();
  const doc = await col.findOne({ _id: lockoutDocId(phoneHash) });
  if (!doc) return false;
  if (doc.lockedUntil && doc.lockedUntil.getTime() > Date.now()) return true;
  if (typeof doc.failedAttempts === "number" && doc.failedAttempts >= MAX_FAILED) {
    return true;
  }
  return false;
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
  claimVerificationAttempt,
  applyLockoutIfNeeded,
  isSendBlockedByLockout,
  isVerifyBlockedByLockout,
  clearLockout,
  resetLockoutsForTests,
  MAX_FAILED,
  lockoutDocId,
};