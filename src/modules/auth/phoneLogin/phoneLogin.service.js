const User = require("../../../shared/models/User");
const { buildLoginSuccessPayload } = require("../auth.service");
const {
  normalizeE164,
  phoneLookupHash,
  encryptPhone,
  phoneLast4,
  maskPhoneForLog,
} = require("./phoneCrypto");
const { startVerification, checkVerification } = require("./twilioVerify.service");
const { consumeGlobalDailyOtpSend } = require("./phoneOtpDailyCap");
const {
  claimVerificationAttempt,
  applyLockoutIfNeeded,
  isSendBlockedByLockout,
  isVerifyBlockedByLockout,
  clearLockout,
} = require("./phoneOtpLockout");
const { phoneLoginOperational } = require("./phoneLogin.config");

const GENERIC_SEND_ERROR = "Unable to send verification code";
const GENERIC_VERIFY_ERROR = "Unable to verify code";
const INVALID_INPUT = "Invalid request";
const LOGIN_START_MESSAGE = "If this number is eligible, a verification code was sent";
const LOGIN_START_MIN_MS = 700;

function isValidOtpCode(code) {
  return typeof code === "string" && /^\d{4,10}$/.test(code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyLoginStartTiming(startedAt) {
  const jitter = Math.floor(Math.random() * 80);
  const targetMs = LOGIN_START_MIN_MS + jitter;
  const elapsed = Date.now() - startedAt;
  const waitMs = targetMs - elapsed;
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

async function assertCanSend(e164) {
  const hash = phoneLookupHash(e164);
  if (!hash) {
    const err = new Error("phone_login_disabled");
    err.status = 503;
    throw err;
  }
  if (await isSendBlockedByLockout(hash)) {
    const err = new Error(GENERIC_SEND_ERROR);
    err.status = 429;
    throw err;
  }
  const { allowed } = await consumeGlobalDailyOtpSend();
  if (!allowed) {
    const err = new Error("Too many verification requests today");
    err.status = 429;
    throw err;
  }
  return hash;
}

async function sendOtp(e164) {
  if (!phoneLoginOperational()) {
    const err = new Error("phone_login_disabled");
    err.status = 503;
    throw err;
  }
  await assertCanSend(e164);
  try {
    await startVerification(e164);
  } catch (err) {
    console.error("phone_otp_send_failed", maskPhoneForLog(e164), err?.code || "Error");
    const wrapped = new Error(GENERIC_SEND_ERROR);
    wrapped.status = 400;
    throw wrapped;
  }
  return { message: LOGIN_START_MESSAGE };
}

async function verifyOtpCode(e164, code) {
  if (!phoneLoginOperational()) {
    const err = new Error("phone_login_disabled");
    err.status = 503;
    throw err;
  }
  if (!isValidOtpCode(String(code))) {
    const err = new Error(INVALID_INPUT);
    err.status = 400;
    throw err;
  }
  const hash = phoneLookupHash(e164);
  if (await isVerifyBlockedByLockout(hash)) {
    const err = new Error(GENERIC_VERIFY_ERROR);
    err.status = 429;
    throw err;
  }

  const claim = await claimVerificationAttempt(hash);
  if (!claim.claimed) {
    const err = new Error(GENERIC_VERIFY_ERROR);
    err.status = 429;
    throw err;
  }

  let check;
  try {
    check = await checkVerification(e164, code);
  } catch (err) {
    console.error("phone_otp_check_failed", maskPhoneForLog(e164), err?.code || "Error");
    await applyLockoutIfNeeded(hash);
    const wrapped = new Error(GENERIC_VERIFY_ERROR);
    wrapped.status = await isSendBlockedByLockout(hash) ? 429 : 400;
    throw wrapped;
  }
  if (!check || check.status !== "approved") {
    await applyLockoutIfNeeded(hash);
    const locked = await isSendBlockedByLockout(hash);
    const err = new Error(GENERIC_VERIFY_ERROR);
    err.status = locked ? 429 : 400;
    throw err;
  }
  await clearLockout(hash);
  return { verified: true, phoneHash: hash };
}

async function attachPhoneToUser(userId, e164) {
  const hash = phoneLookupHash(e164);
  const enc = encryptPhone(e164);
  if (!hash || !enc) {
    const err = new Error("phone_login_disabled");
    err.status = 503;
    throw err;
  }

  const existing = await User.findOne({
    phoneLookupHash: hash,
    _id: { $ne: userId },
    phoneVerified: true,
  }).select("_id");
  if (existing) {
    const err = new Error(GENERIC_VERIFY_ERROR);
    err.status = 400;
    throw err;
  }

  const now = new Date();
  let user;
  try {
    user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          phoneEnc: enc,
          phoneLookupHash: hash,
          phoneLast4: phoneLast4(e164),
          phoneVerified: true,
          phoneVerifiedAt: now,
        },
      },
      { new: true, runValidators: true },
    );
  } catch (err) {
    if (err && err.code === 11000) {
      const dup = new Error(GENERIC_VERIFY_ERROR);
      dup.status = 400;
      throw dup;
    }
    throw err;
  }
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  return user;
}

async function startVerifyForUser(userId, rawPhone) {
  const e164 = normalizeE164(rawPhone);
  if (!e164) {
    const err = new Error(INVALID_INPUT);
    err.status = 400;
    throw err;
  }
  return sendOtp(e164);
}

async function confirmVerifyForUser(userId, rawPhone, code) {
  const e164 = normalizeE164(rawPhone);
  if (!e164) {
    const err = new Error(INVALID_INPUT);
    err.status = 400;
    throw err;
  }
  await verifyOtpCode(e164, code);
  const user = await attachPhoneToUser(userId, e164);
  return {
    message: "Phone verified",
    phoneVerified: Boolean(user.phoneVerified),
    phoneLast4: user.phoneLast4 || null,
  };
}

async function loginStart(rawPhone) {
  const startedAt = Date.now();
  const e164 = normalizeE164(rawPhone);
  if (!e164) {
    const err = new Error(INVALID_INPUT);
    err.status = 400;
    throw err;
  }
  const hash = phoneLookupHash(e164);
  const user = await User.findOne({ phoneLookupHash: hash, phoneVerified: true }).select("_id");

  if (user) {
    try {
      await sendOtp(e164);
    } catch (err) {
      const code =
        err && err.code
          ? err.code
          : err && err.status === 429
            ? "rate_limited"
            : err && err.status === 503
              ? "not_configured"
              : "send_failed";
      console.error("phone_login_start_send_failed", maskPhoneForLog(e164), code);
    }
  }

  await applyLoginStartTiming(startedAt);
  return { message: LOGIN_START_MESSAGE };
}

async function loginVerify(rawPhone, code) {
  const e164 = normalizeE164(rawPhone);
  if (!e164) {
    const err = new Error(INVALID_INPUT);
    err.status = 400;
    throw err;
  }
  await verifyOtpCode(e164, code);
  const hash = phoneLookupHash(e164);
  const user = await User.findOne({ phoneLookupHash: hash, phoneVerified: true });
  if (!user) {
    const err = new Error(GENERIC_VERIFY_ERROR);
    err.status = 400;
    throw err;
  }
  await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
  return buildLoginSuccessPayload(user);
}

async function statusForUser(userId) {
  const user = await User.findById(userId).select("phoneVerified phoneLast4");
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  return {
    phoneVerified: Boolean(user.phoneVerified),
    phoneLast4: user.phoneLast4 || null,
  };
}

module.exports = {
  startVerifyForUser,
  confirmVerifyForUser,
  loginStart,
  loginVerify,
  statusForUser,
  sendOtp,
  verifyOtpCode,
  normalizeE164,
  LOGIN_START_MESSAGE,
};