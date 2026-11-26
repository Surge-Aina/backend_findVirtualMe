const crypto = require("crypto");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const { decode32ByteKey } = require("./phoneLogin.config");

function normalizeE164(rawPhone, defaultCountry = "US") {
  if (!rawPhone || typeof rawPhone !== "string") return null;
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format("E.164");
}

function phoneLast4(e164) {
  const digits = String(e164).replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return digits.slice(-4);
}

function maskPhoneForLog(e164) {
  return `***${phoneLast4(e164)}`;
}

function phoneLookupHash(e164) {
  const key = decode32ByteKey("PHONE_HASH_KEY");
  if (!key) return null;
  return crypto.createHmac("sha256", key).update(e164).digest("hex");
}

function encryptPhone(e164) {
  const key = decode32ByteKey("PHONE_ENC_KEY");
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(e164, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

function decryptPhone(payload) {
  const key = decode32ByteKey("PHONE_ENC_KEY");
  if (!key || !payload || typeof payload !== "string") return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  const [ivB64, tagB64, dataB64] = parts;
  try {
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (_err) {
    return null;
  }
}

module.exports = {
  normalizeE164,
  phoneLast4,
  maskPhoneForLog,
  phoneLookupHash,
  encryptPhone,
  decryptPhone,
};