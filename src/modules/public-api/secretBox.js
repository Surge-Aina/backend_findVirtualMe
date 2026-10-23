const crypto = require("crypto");

/**
 * AES-256-GCM for partner secrets. The key version is stored beside the
 * ciphertext so a later key can decrypt older rows.
 *
 * Version 1 reads PARTNER_CREDENTIALS_KEY_V1, then PARTNER_CREDENTIALS_KEY.
 * Later versions read PARTNER_CREDENTIALS_KEY_V<n>.
 * The version used for new ciphertext is PARTNER_CREDENTIALS_KEY_VERSION (default "1").
 */

function currentKeyVersion() {
  const raw = process.env.PARTNER_CREDENTIALS_KEY_VERSION;
  if (raw === undefined || raw === "") return "1";
  if (!/^\d+$/.test(raw) || raw === "0") return "1";
  return String(Number(raw));
}

function decodeKeyMaterial(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  } catch (_err) {
    return null;
  }
  return null;
}

function keyForVersion(version) {
  const specific = process.env[`PARTNER_CREDENTIALS_KEY_V${version}`];
  const fallback = version === "1" ? process.env.PARTNER_CREDENTIALS_KEY : undefined;
  return decodeKeyMaterial(specific || fallback || "");
}

function encryptSecret(plaintext) {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    const err = new Error("Nothing to encrypt");
    err.code = "encryption_failed";
    throw err;
  }
  const keyVersion = currentKeyVersion();
  const key = keyForVersion(keyVersion);
  if (!key) {
    const err = new Error("Credential encryption key is not configured");
    err.code = "credential_storage_unconfigured";
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    keyVersion,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

function decryptSecret({ keyVersion, ciphertext, iv, authTag }) {
  const key = keyForVersion(String(keyVersion || "1"));
  if (!key) {
    const err = new Error("Credential encryption key is not configured");
    err.code = "credential_storage_unconfigured";
    throw err;
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

module.exports = {
  currentKeyVersion,
  encryptSecret,
  decryptSecret,
};
