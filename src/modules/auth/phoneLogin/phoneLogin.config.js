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

function parseCountryAllowlist(raw) {
  const source =
    raw != null && String(raw).trim() !== ""
      ? String(raw)
      : "US,GB,IN";
  const set = new Set();
  for (const part of source.split(",")) {
    const iso = part.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(iso)) set.add(iso);
  }
  if (set.size === 0) {
    set.add("US");
    set.add("GB");
    set.add("IN");
  }
  return set;
}

function getPhoneLoginCountryAllowlist() {
  return parseCountryAllowlist(process.env.PHONE_LOGIN_COUNTRIES);
}

function getCountryOtpHourlyCap(isoCountry) {
  const iso = String(isoCountry || "").toUpperCase();
  const perCountry = readPositiveInt(`PHONE_OTP_COUNTRY_HOURLY_CAP_${iso}`, 0);
  if (perCountry > 0) return perCountry;
  if (iso === "IN") {
    return readPositiveInt("PHONE_OTP_COUNTRY_HOURLY_CAP_IN", 8);
  }
  return readPositiveInt("PHONE_OTP_COUNTRY_HOURLY_CAP", 25);
}

function getCountryOtpDailyCap(isoCountry) {
  const iso = String(isoCountry || "").toUpperCase();
  const perCountry = readPositiveInt(`PHONE_OTP_COUNTRY_DAILY_CAP_${iso}`, 0);
  if (perCountry > 0) return perCountry;
  if (iso === "IN") {
    return readPositiveInt("PHONE_OTP_COUNTRY_DAILY_CAP_IN", 40);
  }
  return readPositiveInt("PHONE_OTP_COUNTRY_DAILY_CAP", 80);
}

function getSmsPumpDistinctMax() {
  return readPositiveInt("PHONE_OTP_PUMP_DISTINCT_MAX", 5);
}

function getSmsPumpWindowMs() {
  return readPositiveInt("PHONE_OTP_PUMP_WINDOW_MS", 15 * 60 * 1000);
}

module.exports = {
  phoneLoginEnabled,
  phoneLoginOperational,
  phoneLoginFlagOn,
  phoneLoginKeysReady,
  getOtpDailyCap,
  decode32ByteKey,
  getPhoneLoginCountryAllowlist,
  getCountryOtpHourlyCap,
  getCountryOtpDailyCap,
  getSmsPumpDistinctMax,
  getSmsPumpWindowMs,
};