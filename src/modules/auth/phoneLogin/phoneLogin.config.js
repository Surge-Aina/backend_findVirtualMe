function readPositiveInt(envName, defaultValue) {
  const raw = process.env[envName];
  if (raw == null || raw === "") return defaultValue;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return defaultValue;
  return n;
}

function decode32ByteKey(envName) {
  const raw = process.env[envName];
  if (!raw || typeof raw !== "string") return null;
  try {
    const buf = Buffer.from(raw.trim(), "base64");
    if (buf.length !== 32) return null;
    return buf;
  } catch (_err) {
    return null;
  }
}

function phoneLoginFlagOn() {
  return process.env.PHONE_LOGIN_ENABLED === "true";
}

function phoneLoginKeysReady() {
  return Boolean(decode32ByteKey("PHONE_ENC_KEY") && decode32ByteKey("PHONE_HASH_KEY"));
}

function phoneLoginEnabled() {
  return phoneLoginFlagOn() && phoneLoginKeysReady();
}

function twilioVerifyConfigured() {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET,
    TWILIO_VERIFY_SERVICE_SID,
  } = process.env;
  return Boolean(
    TWILIO_ACCOUNT_SID &&
      TWILIO_API_KEY_SID &&
      TWILIO_API_KEY_SECRET &&
      TWILIO_VERIFY_SERVICE_SID,
  );
}

function phoneLoginOperational() {
  return phoneLoginEnabled() && twilioVerifyConfigured();
}

function getOtpDailyCap() {
  return readPositiveInt("OTP_DAILY_CAP", 200);
}

module.exports = {
  phoneLoginEnabled,
  phoneLoginOperational,
  phoneLoginFlagOn,
  phoneLoginKeysReady,
  getOtpDailyCap,
  decode32ByteKey,
};